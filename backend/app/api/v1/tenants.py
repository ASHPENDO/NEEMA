from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth import get_current_user
from app.api.v1.tenant_invitations import (
    accept_tenant_invitation as accept_tenant_invitation_authoritative,
)
from app.api.deps.tenant import (
    get_current_tenant,
    get_current_membership,
    require_tenant_roles,
)
from app.db.session import get_db
from app.models.tenant import Tenant
from app.models.tenant_invitation import TenantInvitation
from app.models.tenant_membership import TenantMembership
from app.models.user import User
from app.schemas.tenant import TenantCreate, TenantOut
from app.schemas.tenant_invitation import (
    AcceptTenantInvite,
    TenantInviteCreate,
    TenantInviteOut,
)

router = APIRouter(prefix="/tenants", tags=["tenants"])

INVITE_EXPIRY_DAYS = 7


# ---------------------------------------------------------
# Helpers
# ---------------------------------------------------------
def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def normalize_email(email: str) -> str:
    return email.strip().lower()


# ---------------------------------------------------------
# Tenant creation
# ---------------------------------------------------------
@router.post("", response_model=TenantOut)
async def create_tenant(
    payload: TenantCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if payload.accepted_terms is not True:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="accepted_terms must be true to create a tenant",
        )

    tenant = Tenant(name=payload.name, tier=payload.tier)
    db.add(tenant)
    await db.flush()

    membership = TenantMembership(
        tenant_id=tenant.id,
        user_id=user.id,
        role="OWNER",
        permissions=[],
        is_active=True,
        accepted_terms=True,
        notifications_opt_in=payload.notifications_opt_in,
        referral_code=payload.referral_code,
    )

    db.add(membership)
    await db.commit()
    await db.refresh(tenant)
    return tenant


# ---------------------------------------------------------
# Tenant scoped endpoints
# ---------------------------------------------------------
@router.get("/current", response_model=TenantOut)
async def get_current_tenant_route(
    tenant: Tenant = Depends(get_current_tenant),
):
    return tenant


@router.get("/membership")
async def get_my_membership_in_current_tenant(
    membership: TenantMembership = Depends(get_current_membership),
):
    return {
        "tenant_id": str(membership.tenant_id),
        "user_id": str(membership.user_id),
        "role": membership.role,
        "permissions": membership.permissions,
        "is_active": membership.is_active,
        "accepted_terms": membership.accepted_terms,
        "notifications_opt_in": membership.notifications_opt_in,
        "referral_code": membership.referral_code,
        "created_at": membership.created_at,
    }


@router.get("/admin-only")
async def admin_only_check(
    _membership: TenantMembership = Depends(require_tenant_roles("OWNER", "ADMIN")),
):
    return {"ok": True}


# =========================================================
# TENANT INVITATIONS (STAFF + ADMIN) — creation/list stay here
# Accept is delegated to authoritative endpoint to avoid divergence.
# =========================================================

@router.post(
    "/invitations",
    response_model=TenantInviteOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_tenant_invitation(
    payload: TenantInviteCreate,
    db: AsyncSession = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
    _membership: TenantMembership = Depends(require_tenant_roles("OWNER", "ADMIN")),
):
    """
    Staff slots are consumed ONLY when accepted.
    Therefore, we DO NOT enforce staff limits at invite creation.
    """

    role = (payload.role or "STAFF").strip().upper()
    if role not in {"ADMIN", "STAFF"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="role must be ADMIN or STAFF",
        )

    email = normalize_email(str(payload.email))

    token = secrets.token_urlsafe(48)
    expires_at = _utcnow() + timedelta(days=INVITE_EXPIRY_DAYS)

    inv = TenantInvitation(
        tenant_id=tenant.id,
        email=email,
        role=role,
        permissions=payload.permissions or [],
        token=token,
        expires_at=expires_at,
    )

    db.add(inv)
    await db.commit()
    await db.refresh(inv)
    return inv


@router.get("/invitations", response_model=List[TenantInviteOut])
async def list_tenant_invitations(
    db: AsyncSession = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
    _membership: TenantMembership = Depends(require_tenant_roles("OWNER", "ADMIN")),
):
    stmt = (
        select(TenantInvitation)
        .where(TenantInvitation.tenant_id == tenant.id)
        .order_by(TenantInvitation.created_at.desc())
    )
    res = await db.execute(stmt)
    return list(res.scalars().all())


@router.post("/invitations/accept")
async def accept_tenant_invitation(
    payload: AcceptTenantInvite,
    db: AsyncSession = Depends(get_db),
):
    """
    Backwards-compatible alias.

    Authoritative implementation lives at:
      POST /api/v1/tenant-invitations/accept
    """
    return await accept_tenant_invitation_authoritative(payload=payload, db=db)
