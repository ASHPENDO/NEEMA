from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.tenant import get_current_tenant, require_tenant_roles
from app.api.v1.auth import get_current_user
from app.core.tier_limits import get_staff_limit_for_tier
from app.core.tier_resolver import resolve_effective_tier
from app.db.session import get_db
from app.models.tenant import Tenant
from app.models.tenant_invitation import TenantInvitation
from app.models.tenant_membership import TenantMembership
from app.models.user import User
from app.schemas.tenant_invitation import (
    AcceptTenantInvite,
    TenantInviteCreate,
    TenantInviteOut,
)

router = APIRouter(prefix="/tenant-invitations", tags=["tenant-invitations"])

INVITE_EXPIRY_DAYS = 7
ALLOWED_INVITE_ROLES = {"ADMIN", "STAFF"}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _normalize_role(role: str | None) -> str:
    return (role or "STAFF").strip().upper()


def _generate_token() -> str:
    return secrets.token_urlsafe(48)


# =========================================================
# CREATE + LIST (tenant-scoped; OWNER/ADMIN only)
# =========================================================
@router.post("", response_model=TenantInviteOut)
async def create_tenant_invitation(
    payload: TenantInviteCreate,
    db: AsyncSession = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
    _member: TenantMembership = Depends(require_tenant_roles("OWNER", "ADMIN")),
    _inviter: User = Depends(get_current_user),
):
    """
    Create a tenant staff invitation (ADMIN/STAFF).
    Requires JWT + X-Tenant-Id + role OWNER/ADMIN in that tenant.

    IMPORTANT: Staff slots are consumed ONLY when accepted.
    """
    email = _normalize_email(str(payload.email))
    role = _normalize_role(payload.role)

    if "@" not in email:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid email",
        )

    if role not in ALLOWED_INVITE_ROLES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid role. Allowed: {', '.join(sorted(ALLOWED_INVITE_ROLES))}",
        )

    # If user exists and is already an ACTIVE member, block
    existing_user = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
    if existing_user is not None:
        existing_membership = (
            await db.execute(
                select(TenantMembership).where(
                    TenantMembership.tenant_id == tenant.id,
                    TenantMembership.user_id == existing_user.id,
                    TenantMembership.is_active.is_(True),
                )
            )
        ).scalar_one_or_none()
        if existing_membership is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="User is already a member of this tenant",
            )

    # Block duplicate PENDING invitation for same tenant+email
    # Pending = accepted_at is NULL and expires_at is in future
    pending_inv = (
        await db.execute(
            select(TenantInvitation).where(
                TenantInvitation.tenant_id == tenant.id,
                TenantInvitation.email == email,
                TenantInvitation.accepted_at.is_(None),
                TenantInvitation.expires_at > _utcnow(),
            )
        )
    ).scalar_one_or_none()
    if pending_inv is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A pending invitation already exists for this email",
        )

    invitation = TenantInvitation(
        tenant_id=tenant.id,
        email=email,
        role=role,
        permissions=payload.permissions or [],
        token=_generate_token(),
        expires_at=_utcnow() + timedelta(days=INVITE_EXPIRY_DAYS),
        accepted_at=None,
        accepted_by_user_id=None,
    )

    db.add(invitation)
    await db.commit()
    await db.refresh(invitation)
    return invitation


@router.get("", response_model=List[TenantInviteOut])
async def list_tenant_invitations(
    db: AsyncSession = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
    _member: TenantMembership = Depends(require_tenant_roles("OWNER", "ADMIN")),
):
    """
    List invitations for the current tenant (requires X-Tenant-Id + OWNER/ADMIN).
    """
    stmt = (
        select(TenantInvitation)
        .where(TenantInvitation.tenant_id == tenant.id)
        .order_by(TenantInvitation.created_at.desc())
    )
    invitations = (await db.execute(stmt)).scalars().all()
    return list(invitations)


# =========================================================
# ACCEPT (public)
# =========================================================
@router.post("/accept")
async def accept_tenant_invitation(
    payload: AcceptTenantInvite,
    db: AsyncSession = Depends(get_db),
):
    """
    Accept invitation by token (public).
    Creates/activates tenant membership for invited user.

    Tier staff-slot enforcement is authoritative here (accept-time), to avoid
    consuming slots for invitations that are never accepted.

    Concurrency hardening:
    - locks invitation row (FOR UPDATE) to prevent double-accept
    - locks tenant row when enforcing staff limits
    - locks membership row when updating/reactivating
    """
    if payload.accept_tos is not True:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="accept_tos must be true",
        )

    token = (payload.token or "").strip()
    if not token:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="token is required")

    # 1) Lock invitation row to prevent concurrent accepts
    inv = (
        await db.execute(
            select(TenantInvitation)
            .where(TenantInvitation.token == token)
            .with_for_update()
        )
    ).scalar_one_or_none()

    if inv is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid invitation token")

    if inv.accepted_at is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Invitation already accepted")

    if inv.expires_at < _utcnow():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invitation expired")

    email = _normalize_email(inv.email)
    invite_role = _normalize_role(inv.role)

    # 2) Ensure user exists (lock user row if present to reduce rare duplicates)
    user = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
    if user is None:
        user = User(email=email, is_active=True)
        db.add(user)
        await db.flush()  # assigns user.id

    # 3) Tier-based staff limit enforcement (ONLY for STAFF role)
    # NOTE: ADMIN invites do not consume STAFF slots (as per your rules).
    if invite_role == "STAFF":
        # Lock tenant row since we’re doing capacity enforcement
        tenant = (
            await db.execute(
                select(Tenant)
                .where(Tenant.id == inv.tenant_id)
                .with_for_update()
            )
        ).scalar_one_or_none()
        if tenant is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")

        tier_str = resolve_effective_tier(tenant)
        max_staff = get_staff_limit_for_tier(tier_str)

        # Does this user already have an ACTIVE STAFF membership? If yes, exclude them from count.
        existing_active_staff = (
            await db.execute(
                select(TenantMembership).where(
                    TenantMembership.tenant_id == inv.tenant_id,
                    TenantMembership.user_id == user.id,
                    TenantMembership.is_active.is_(True),
                    TenantMembership.role == "STAFF",
                )
            )
        ).scalar_one_or_none()

        count_stmt = select(TenantMembership).where(
            TenantMembership.tenant_id == inv.tenant_id,
            TenantMembership.is_active.is_(True),
            TenantMembership.role == "STAFF",
        )
        if existing_active_staff is not None:
            count_stmt = count_stmt.where(TenantMembership.user_id != user.id)

        active_staff_count = len((await db.execute(count_stmt)).scalars().all())

        if active_staff_count >= max_staff:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "STAFF_LIMIT_EXCEEDED",
                    "message": "Staff limit exceeded for this tenant tier. Upgrade your plan to add more staff.",
                    "tier": tier_str,
                    "limit": max_staff,
                    "active_staff": active_staff_count,
                },
            )

    # 4) Create or reactivate membership (lock row if exists)
    membership = (
        await db.execute(
            select(TenantMembership)
            .where(
                TenantMembership.tenant_id == inv.tenant_id,
                TenantMembership.user_id == user.id,
            )
            .with_for_update()
        )
    ).scalar_one_or_none()

    if membership is None:
        membership = TenantMembership(
            tenant_id=inv.tenant_id,
            user_id=user.id,
            role=invite_role,
            permissions=inv.permissions or [],
            accepted_terms=True,
            notifications_opt_in=payload.accept_notifications,
            is_active=True,
            referral_code=None,
        )
        db.add(membership)
    else:
        membership.is_active = True
        membership.role = invite_role
        membership.permissions = inv.permissions or []
        membership.accepted_terms = True
        membership.notifications_opt_in = payload.accept_notifications

    # 5) Mark invitation accepted
    inv.accepted_at = _utcnow()
    inv.accepted_by_user_id = user.id

    await db.commit()

    return {
        "status": "ok",
        "tenant_id": str(inv.tenant_id),
        "user_id": str(user.id),
        "role": membership.role,
    }
