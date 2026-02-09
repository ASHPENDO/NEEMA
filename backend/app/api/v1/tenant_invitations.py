from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.api.v1.auth import get_current_user
from app.models.user import User
from app.models.tenant import Tenant
from app.models.tenant_membership import TenantMembership
from app.models.tenant_invitation import TenantInvitation
from app.api.deps.tenant import get_current_tenant, require_tenant_roles
from app.schemas.tenant_invitation import TenantInviteCreate, TenantInviteOut, AcceptTenantInvite

router = APIRouter(prefix="/tenant-invitations", tags=["tenant-invitations"])

INVITE_EXPIRY_DAYS = 7
ALLOWED_INVITE_ROLES = {"ADMIN", "STAFF"}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _generate_token() -> str:
    return secrets.token_urlsafe(48)


@router.post("", response_model=TenantInviteOut)
async def create_tenant_invitation(
    payload: TenantInviteCreate,
    db: AsyncSession = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
    _member: TenantMembership = Depends(require_tenant_roles("OWNER", "ADMIN")),
    inviter: User = Depends(get_current_user),
):
    """
    Create a tenant staff invitation (ADMIN/STAFF).
    Requires JWT + X-Tenant-Id + role OWNER/ADMIN in that tenant.
    Dev-mode: returns token in response for Swagger testing.
    """
    email = _normalize_email(str(payload.email))
    role = (payload.role or "STAFF").upper()

    if role not in ALLOWED_INVITE_ROLES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid role. Allowed: {', '.join(sorted(ALLOWED_INVITE_ROLES))}",
        )

    # If user exists and already an active member, block
    u_stmt = select(User).where(User.email == email)
    existing_user = (await db.execute(u_stmt)).scalar_one_or_none()
    if existing_user:
        m_stmt = select(TenantMembership).where(
            TenantMembership.tenant_id == tenant.id,
            TenantMembership.user_id == existing_user.id,
            TenantMembership.is_active.is_(True),
        )
        existing_membership = (await db.execute(m_stmt)).scalar_one_or_none()
        if existing_membership:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="User is already a member of this tenant",
            )

    # Create invitation
    invitation = TenantInvitation(
        tenant_id=tenant.id,
        email=email,
        role=role,
        permissions=payload.permissions,
        token=_generate_token(),
        expires_at=_utcnow() + timedelta(days=INVITE_EXPIRY_DAYS),
        accepted_at=None,
        accepted_by_user_id=None,
    )

    db.add(invitation)
    await db.commit()
    await db.refresh(invitation)
    return invitation


@router.get("", response_model=list[TenantInviteOut])
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


@router.post("/accept")
async def accept_tenant_invitation(
    payload: AcceptTenantInvite,
    db: AsyncSession = Depends(get_db),
):
    """
    Accept invitation by token (public).
    Creates/activates tenant membership for invited user.

    Accept flow is public so a new user can accept first, then login via magic-code.
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
    inv = (await db.execute(stmt)).scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid invitation token")

    if inv.accepted_at is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Invitation already accepted")

    if inv.expires_at < _utcnow():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invitation expired")

    email = _normalize_email(inv.email)

    # Ensure user exists
    u_stmt = select(User).where(User.email == email)
    user = (await db.execute(u_stmt)).scalar_one_or_none()
    if user is None:
        user = User(email=email, is_active=True)
        db.add(user)
        await db.flush()

    # Create or reactivate membership
    m_stmt = select(TenantMembership).where(
        TenantMembership.tenant_id == inv.tenant_id,
        TenantMembership.user_id == user.id,
    )
    membership = (await db.execute(m_stmt)).scalar_one_or_none()

    if membership is None:
        membership = TenantMembership(
            tenant_id=inv.tenant_id,
            user_id=user.id,
            role=inv.role,
            permissions=inv.permissions or [],
            accepted_terms=True,
            notifications_opt_in=payload.accept_notifications,
            is_active=True,
            referral_code=None,
        )
        db.add(membership)
    else:
        membership.is_active = True
        membership.role = inv.role
        membership.permissions = inv.permissions or []
        membership.accepted_terms = True
        membership.notifications_opt_in = payload.accept_notifications

    # Mark invitation accepted
    inv.accepted_at = _utcnow()
    inv.accepted_by_user_id = user.id

    await db.commit()

    return {
        "status": "ok",
        "tenant_id": str(inv.tenant_id),
        "user_id": str(user.id),
        "role": membership.role,
    }
