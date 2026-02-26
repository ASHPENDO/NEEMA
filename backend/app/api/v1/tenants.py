# app/api/v1/tenants.py
from __future__ import annotations

import uuid
import secrets
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth import get_current_user
from app.api.deps.tenant import (
    get_current_tenant,
    get_current_membership,
    require_tenant_roles,
)
from app.core.sales_attribution import (
    compute_commission_kes,
    normalize_referral_code,
    resolve_salesperson_by_referral_code,
    utcnow,
)
from app.core.tier_limits import get_staff_limit_for_tier
from app.core.tier_resolver import resolve_effective_tier
from app.db.session import get_db
from app.models.salesperson_earning_event import SalespersonEarningEvent
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


def _role_normalize(role: str | None) -> str:
    r = (role or "STAFF").strip().upper()
    return r


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

    # --- Sales attribution (optional) ---
    normalized_code = normalize_referral_code(getattr(payload, "referral_code", None))

    salesperson_profile = None
    if normalized_code:
        salesperson_profile = await resolve_salesperson_by_referral_code(db, normalized_code)
        if salesperson_profile is None:
            raise HTTPException(status_code=400, detail="Invalid referral_code")

    # ✅ Tenant model does NOT store onboarding flags; those live on TenantMembership.
    tenant = Tenant(
        name=payload.name,
        tier=payload.tier,
        salesperson_profile_id=(salesperson_profile.id if salesperson_profile else None),
    )
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
        referral_code=normalized_code,
    )

    db.add(membership)
    await db.commit()
    await db.refresh(tenant)

    # --- Sales ledger event: TENANT_SIGNUP ---
    if salesperson_profile:
        gross_amount = Decimal("10000.00")
        commission_amount = compute_commission_kes(tier=str(tenant.tier), gross_amount_kes=gross_amount)

        event = SalespersonEarningEvent(
            salesperson_profile_id=salesperson_profile.id,
            tenant_id=tenant.id,
            event_type="TENANT_SIGNUP",
            currency="KES",
            gross_amount=gross_amount,
            commission_amount=commission_amount,
            source="MANUAL",
            occurred_at=utcnow(),
            event_metadata={
                "referral_code": normalized_code,
                "tenant_tier": str(tenant.tier),
                "policy": {"type": "flat_rate", "rate": "0.20"},
            },
        )
        db.add(event)
        await db.commit()

    return tenant


# ---------------------------------------------------------
# Tenant list (for TenantGate / TenantSelection)
# ---------------------------------------------------------
@router.get("", response_model=List[TenantOut])
async def list_my_tenants(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Returns all tenants the current user is an active member of.
    This powers:
      - TenantGate (0 / 1 / many)
      - TenantSelection UI
    """
    stmt = (
        select(Tenant)
        .join(TenantMembership, TenantMembership.tenant_id == Tenant.id)
        .where(TenantMembership.user_id == user.id)
        .where(TenantMembership.is_active.is_(True))
        .order_by(Tenant.created_at.desc())
    )
    res = await db.execute(stmt)
    tenants = res.scalars().unique().all()
    return list(tenants)


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
# TENANT INVITATIONS
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
    role = _role_normalize(payload.role)
    if role not in {"ADMIN", "STAFF"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="role must be ADMIN or STAFF")

    email = normalize_email(str(payload.email))
    if "@" not in email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="email is invalid")

    user_stmt = select(User).where(User.email == email).limit(1)
    existing_user = (await db.execute(user_stmt)).scalar_one_or_none()
    if existing_user is not None:
        mem_stmt = (
            select(TenantMembership)
            .where(TenantMembership.tenant_id == tenant.id)
            .where(TenantMembership.user_id == existing_user.id)
            .limit(1)
        )
        if (await db.execute(mem_stmt)).scalar_one_or_none() is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User is already a member of this tenant")

    pending_stmt = (
        select(TenantInvitation)
        .where(TenantInvitation.tenant_id == tenant.id)
        .where(TenantInvitation.email == email)
        .where(TenantInvitation.accepted_at.is_(None))
        .where(TenantInvitation.expires_at > _utcnow())
        .limit(1)
    )
    if (await db.execute(pending_stmt)).scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A pending invitation already exists for this email")

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
    current_user: User = Depends(get_current_user),
):
    """
    Accept invitation by token (AUTHENTICATED; magic-code).
    - Requires JWT.
    - Enforces that current_user.email matches invitation.email.
    - Does NOT create users (auth flow already did that).
    - Creates/reactivates membership and marks invite accepted.
    """
    if payload.accept_tos is not True:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="accept_tos must be true")

    token = (payload.token or "").strip()
    if not token:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="token is required")

    # Lock invitation row to prevent concurrent accepts
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

    invite_email = normalize_email(inv.email)
    user_email = normalize_email(current_user.email or "")
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

    invite_role = _role_normalize(inv.role)

    # Tier staff-slot enforcement (ONLY for STAFF)
    if invite_role == "STAFF":
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

        existing_active_staff = (
            await db.execute(
                select(TenantMembership).where(
                    TenantMembership.tenant_id == inv.tenant_id,
                    TenantMembership.user_id == current_user.id,
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
            count_stmt = count_stmt.where(TenantMembership.user_id != current_user.id)

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

    # Create or reactivate membership
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


@router.post("/invitations/{invite_id}/revoke", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_tenant_invitation(
    invite_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
    _membership: TenantMembership = Depends(require_tenant_roles("OWNER", "ADMIN")),
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

    # Soft-revoke by expiring it now (keeps audit trail)
    inv.expires_at = _utcnow()
    await db.commit()
    return None


@router.post("/invitations/{invite_id}/resend", status_code=status.HTTP_204_NO_CONTENT)
async def resend_tenant_invitation(
    invite_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
    _membership: TenantMembership = Depends(require_tenant_roles("OWNER", "ADMIN")),
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

    # TODO: wire email sender; for now optionally log token/link
    # print(f"[TENANT_INVITE_RESEND] tenant={tenant.id} email={inv.email} token={inv.token}")

    await db.commit()
    return None