from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.api.v1.auth import get_current_user
from app.models.user import User
from app.models.tenant import Tenant
from app.models.tenant_membership import TenantMembership
from app.models.tenant_invitation import TenantInvitation
from app.schemas.tenant import TenantCreate, TenantOut
from app.schemas.tenant_invitation import (
    TenantInviteCreate,
    TenantInviteOut,
    AcceptTenantInvite,
)
from app.api.deps.tenant import (
    get_current_tenant,
    get_current_membership,
    require_tenant_roles,
)
from app.crud.tenant_membership import (
    count_active_staff_memberships,
    count_active_staff_memberships_excluding_user,
)

router = APIRouter(prefix="/tenants", tags=["tenants"])

INVITE_EXPIRY_DAYS = 7

TIER_STAFF_LIMITS = {
    "sungura": 1,
    "swara": 5,
    "ndovu": 10,
}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def normalize_email(email: str) -> str:
    return email.strip().lower()


def _tier_staff_limit(tier: str) -> int:
    # Default to most permissive if tier unknown (but better to keep strict in prod).
    return TIER_STAFF_LIMITS.get((tier or "").strip().lower(), 10)


def _upgrade_hint(limit: int) -> str:
    if limit <= 1:
        return "Upgrade to Swara (5 staff) or Ndovu (10 staff) to add more staff."
    if limit <= 5:
        return "Upgrade to Ndovu (10 staff) to add more staff."
    return "Upgrade your tier to add more staff."


# ---------------------------------------------------------
# Tenant creation (NOT scoped — tenant does not exist yet)
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
    await db.flush()  # get tenant.id

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
# Tenant scoping proof endpoints (Phase 1)
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


# ---------------------------------------------------------
# RBAC proof endpoint (Phase 2 starts here)
# ---------------------------------------------------------
@router.get("/admin-only")
async def admin_only_check(
    _membership: TenantMembership = Depends(require_tenant_roles("OWNER", "ADMIN")),
):
    return {"ok": True}


# =========================================================
# A) TENANT INVITATIONS (STAFF) + B) TIER STAFF LIMITS
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
    Tenant invites staff/admin to their tenant.

    For STAFF: enforce tier-based staff limit at invite creation time.
    For ADMIN: no staff-limit enforcement (ADMIN is not counted as STAFF).
    """
    role = (payload.role or "STAFF").strip().upper()
    if role not in {"ADMIN", "STAFF"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="role must be ADMIN or STAFF",
        )

    email = normalize_email(str(payload.email))

    # Enforce tier staff limit for STAFF invites (prevents sending invites when full)
    if role == "STAFF":
        limit = _tier_staff_limit(str(tenant.tier))
        current_staff = await count_active_staff_memberships(db, tenant.id)
        if current_staff >= limit:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "message": f"Staff limit reached for tier '{tenant.tier}'.",
                    "tier": tenant.tier,
                    "limit": limit,
                    "current_active_staff": current_staff,
                    "upgrade_hint": _upgrade_hint(limit),
                },
            )

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
    user: User = Depends(get_current_user),
):
    """
    Staff follows invite link, signs in via magic code, then calls accept.

    Hardening:
    - token must exist and not be expired
    - invitation email must match signed-in user email (prevents token sharing)
    - idempotent accept (if already accepted by this user, return ok)
    - membership upsert
    - tier staff limit enforced at acceptance too (handles race: staff filled after invite sent)
    """
    if payload.accept_tos is not True:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="accept_tos must be true",
        )

    token = payload.token.strip()
    if not token:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="token is required")

    stmt = select(TenantInvitation).where(TenantInvitation.token == token)
    res = await db.execute(stmt)
    inv: TenantInvitation | None = res.scalar_one_or_none()
    if inv is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found")

    now = _utcnow()
    if inv.expires_at < now:
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Invitation has expired")

    # Prevent token sharing: invitation email must match authenticated user's email
    user_email = normalize_email(getattr(user, "email", "") or "")
    if user_email != normalize_email(inv.email):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invitation email does not match the authenticated user",
        )

    # If already accepted by this user: idempotent OK
    if inv.accepted_at is not None and inv.accepted_by_user_id == user.id:
        return {"ok": True, "tenant_id": str(inv.tenant_id), "status": "already_accepted"}

    # Load tenant for tier limit check and membership creation
    tenant_stmt = select(Tenant).where(Tenant.id == inv.tenant_id)
    tenant_res = await db.execute(tenant_stmt)
    tenant: Tenant | None = tenant_res.scalar_one_or_none()
    if tenant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")

    invited_role = (inv.role or "STAFF").strip().upper()

    # Enforce tier staff limit for STAFF accepts (race-safe)
    if invited_role == "STAFF":
        limit = _tier_staff_limit(str(tenant.tier))

        # If user already active STAFF in this tenant, don't block (idempotent/reactivation safe)
        staff_count_excl = await count_active_staff_memberships_excluding_user(
            db=db,
            tenant_id=tenant.id,
            exclude_user_id=user.id,
        )
        if staff_count_excl >= limit:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "message": f"Staff limit reached for tier '{tenant.tier}'.",
                    "tier": tenant.tier,
                    "limit": limit,
                    "current_active_staff": staff_count_excl,
                    "upgrade_hint": _upgrade_hint(limit),
                },
            )

    # Upsert membership (tenant_id + user_id is unique)
    mem_stmt = select(TenantMembership).where(
        TenantMembership.tenant_id == tenant.id,
        TenantMembership.user_id == user.id,
    )
    mem_res = await db.execute(mem_stmt)
    membership: TenantMembership | None = mem_res.scalar_one_or_none()

    if membership is None:
        membership = TenantMembership(
            tenant_id=tenant.id,
            user_id=user.id,
            role=invited_role,
            permissions=inv.permissions or [],
            is_active=True,
            accepted_terms=True,
            notifications_opt_in=payload.accept_notifications,
            referral_code=None,
        )
        db.add(membership)
    else:
        # Update existing membership for this tenant/user
        membership.role = invited_role
        membership.permissions = inv.permissions or []
        membership.is_active = True
        membership.accepted_terms = True
        membership.notifications_opt_in = payload.accept_notifications

    # Mark invitation accepted
    inv.accepted_at = now
    inv.accepted_by_user_id = user.id

    await db.commit()
    return {"ok": True, "tenant_id": str(tenant.id), "role": invited_role}
