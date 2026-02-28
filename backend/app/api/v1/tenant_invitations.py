from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.tenant import get_current_tenant
from app.api.deps.permissions import require_permissions
from app.api.v1.auth import get_current_user
from app.auth.permissions import PERM
from app.core.tier_limits import get_admin_limit_for_tier, get_staff_limit_for_tier
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


async def _count_active_role(db: AsyncSession, tenant_id, role: str) -> int:
    stmt = (
        select(func.count())
        .select_from(TenantMembership)
        .where(TenantMembership.tenant_id == tenant_id)
        .where(TenantMembership.is_active.is_(True))
        .where(TenantMembership.role == role)
    )
    return int((await db.execute(stmt)).scalar_one())


# =========================================================
# CREATE + LIST (tenant-scoped; permission-gated)
# =========================================================
@router.post("", response_model=TenantInviteOut, status_code=status.HTTP_201_CREATED)
async def create_tenant_invitation(
    payload: TenantInviteCreate,
    db: AsyncSession = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
    _member: TenantMembership = Depends(require_permissions(PERM.TENANT_INVITES_MANAGE)),
    _inviter: User = Depends(get_current_user),
):
    """
    Create a tenant invitation (ADMIN/STAFF).
    Soft-enforces seat limits at invite time (UX).
    Hard-enforcement happens at accept time.
    """
    email = _normalize_email(str(payload.email))
    role = _normalize_role(payload.role)

    if "@" not in email:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid email")

    if role not in ALLOWED_INVITE_ROLES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid role. Allowed: {', '.join(sorted(ALLOWED_INVITE_ROLES))}",
        )

    tier_str = resolve_effective_tier(tenant)

    if role == "ADMIN":
        limit_admin = get_admin_limit_for_tier(tier_str)
        active_admins = await _count_active_role(db, tenant.id, "ADMIN")
        if active_admins >= limit_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "ADMIN_LIMIT_EXCEEDED",
                    "message": "This tenant already has the maximum number of admins for its plan.",
                    "tier": tier_str,
                    "limit": limit_admin,
                    "active_admins": active_admins,
                },
            )

    if role == "STAFF":
        max_staff = get_staff_limit_for_tier(tier_str)
        active_staff = await _count_active_role(db, tenant.id, "STAFF")
        if active_staff >= max_staff:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "STAFF_LIMIT_EXCEEDED",
                    "message": "Staff limit exceeded for this tenant tier. Upgrade your plan to add more staff.",
                    "tier": tier_str,
                    "limit": max_staff,
                    "active_staff": active_staff,
                },
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
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User is already a member of this tenant")

    # Block duplicate pending invitation for same tenant+email
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

    inv = TenantInvitation(
        tenant_id=tenant.id,
        email=email,
        role=role,
        permissions=payload.permissions or [],
        token=_generate_token(),
        expires_at=_utcnow() + timedelta(days=INVITE_EXPIRY_DAYS),
        accepted_at=None,
        accepted_by_user_id=None,
    )
    db.add(inv)
    await db.commit()
    await db.refresh(inv)
    return inv


@router.get("", response_model=List[TenantInviteOut])
async def list_tenant_invitations(
    db: AsyncSession = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
    _member: TenantMembership = Depends(require_permissions(PERM.TENANT_INVITES_MANAGE)),
):
    stmt = (
        select(TenantInvitation)
        .where(TenantInvitation.tenant_id == tenant.id)
        .order_by(TenantInvitation.created_at.desc())
    )
    return list((await db.execute(stmt)).scalars().all())


# =========================================================
# ACCEPT (AUTHENTICATED) - matches your email-locked flow
# =========================================================
@router.post("/accept")
async def accept_tenant_invitation(
    payload: AcceptTenantInvite,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Accept invitation by token (AUTHENTICATED; magic-code).
    Hard-enforces:
      - 1 ADMIN per tenant (all tiers)
      - STAFF limit by tier (sungura=1, swara=4, ndovu=9)
    """
    if payload.accept_tos is not True:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="accept_tos must be true")

    token = (payload.token or "").strip()
    if not token:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="token is required")

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

    invite_email = _normalize_email(inv.email)
    user_email = _normalize_email(current_user.email or "")
    if user_email != invite_email:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "INVITE_EMAIL_MISMATCH",
                "message": "You are signed in with a different email than the invitation.",
                "invited_email": invite_email,
                "current_email": user_email,
            },
        )

    invite_role = _normalize_role(inv.role)
    if invite_role not in ALLOWED_INVITE_ROLES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid invitation role")

    tenant = (
        await db.execute(
            select(Tenant).where(Tenant.id == inv.tenant_id).with_for_update()
        )
    ).scalar_one_or_none()
    if tenant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")

    tier_str = resolve_effective_tier(tenant)

    if invite_role == "ADMIN":
        limit_admin = get_admin_limit_for_tier(tier_str)
        active_admins = await _count_active_role(db, tenant.id, "ADMIN")

        existing_active_admin = (
            await db.execute(
                select(TenantMembership).where(
                    TenantMembership.tenant_id == tenant.id,
                    TenantMembership.user_id == current_user.id,
                    TenantMembership.is_active.is_(True),
                    TenantMembership.role == "ADMIN",
                )
            )
        ).scalar_one_or_none()
        if existing_active_admin is not None:
            active_admins = max(0, active_admins - 1)

        if active_admins >= limit_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "ADMIN_LIMIT_EXCEEDED",
                    "message": "Admin limit exceeded for this tenant plan.",
                    "tier": tier_str,
                    "limit": limit_admin,
                    "active_admins": active_admins,
                },
            )

    if invite_role == "STAFF":
        max_staff = get_staff_limit_for_tier(tier_str)
        active_staff = await _count_active_role(db, tenant.id, "STAFF")

        existing_active_staff = (
            await db.execute(
                select(TenantMembership).where(
                    TenantMembership.tenant_id == tenant.id,
                    TenantMembership.user_id == current_user.id,
                    TenantMembership.is_active.is_(True),
                    TenantMembership.role == "STAFF",
                )
            )
        ).scalar_one_or_none()
        if existing_active_staff is not None:
            active_staff = max(0, active_staff - 1)

        if active_staff >= max_staff:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "STAFF_LIMIT_EXCEEDED",
                    "message": "Staff limit exceeded for this tenant tier. Upgrade your plan to add more staff.",
                    "tier": tier_str,
                    "limit": max_staff,
                    "active_staff": active_staff,
                },
            )

    membership = (
        await db.execute(
            select(TenantMembership)
            .where(
                TenantMembership.tenant_id == inv.tenant_id,
                TenantMembership.user_id == current_user.id,
            )
            .with_for_update()
        )
    ).scalar_one_or_none()

    if membership is None:
        membership = TenantMembership(
            tenant_id=inv.tenant_id,
            user_id=current_user.id,
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

    inv.accepted_at = _utcnow()
    inv.accepted_by_user_id = current_user.id

    await db.commit()

    return {
        "status": "ok",
        "tenant_id": str(inv.tenant_id),
        "user_id": str(current_user.id),
        "role": membership.role,
    }


@router.post("/{invite_id}/revoke", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_tenant_invitation(
    invite_id,
    db: AsyncSession = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
    _member: TenantMembership = Depends(require_permissions(PERM.TENANT_INVITES_MANAGE)),
    _actor: User = Depends(get_current_user),
):
    inv = (
        await db.execute(
            select(TenantInvitation)
            .where(
                TenantInvitation.id == invite_id,
                TenantInvitation.tenant_id == tenant.id,
            )
            .with_for_update()
        )
    ).scalar_one_or_none()

    if inv is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found")

    if inv.accepted_at is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Invitation already accepted")

    if inv.expires_at < _utcnow():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Invitation already expired")

    inv.expires_at = _utcnow()
    await db.commit()
    return None


@router.post("/{invite_id}/resend", status_code=status.HTTP_204_NO_CONTENT)
async def resend_tenant_invitation(
    invite_id,
    db: AsyncSession = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
    _member: TenantMembership = Depends(require_permissions(PERM.TENANT_INVITES_MANAGE)),
):
    inv = (
        await db.execute(
            select(TenantInvitation)
            .where(
                TenantInvitation.id == invite_id,
                TenantInvitation.tenant_id == tenant.id,
            )
            .with_for_update()
        )
    ).scalar_one_or_none()

    if inv is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found")

    if inv.accepted_at is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Invitation already accepted")

    if inv.expires_at < _utcnow():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Invitation expired")

    # TODO: send email
    await db.commit()
    return None