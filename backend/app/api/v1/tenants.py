# app/api/v1/tenants.py
from __future__ import annotations

import uuid
from decimal import Decimal
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth import get_current_user
from app.api.deps.tenant import (
    get_current_tenant,
    get_current_membership,
)
from app.api.deps.permissions import require_permissions
from app.auth.permissions import PERM
from app.core.sales_attribution import (
    compute_commission_kes,
    normalize_referral_code,
    resolve_salesperson_by_referral_code,
    utcnow,
)
from app.db.session import get_db
from app.models.salesperson_earning_event import SalespersonEarningEvent
from app.models.tenant import Tenant
from app.models.tenant_membership import TenantMembership
from app.models.user import User
from app.schemas.tenant import TenantCreate, TenantOut
from app.schemas.tenant_membership import TenantMemberOut, TenantMemberUpdate

router = APIRouter(prefix="/tenants", tags=["tenants"])


# ---------------------------------------------------------
# Helpers
# ---------------------------------------------------------
def _role_normalize(role: str | None) -> str:
    return (role or "STAFF").strip().upper()


# ---------------------------------------------------------
# Tenant creation
# ---------------------------------------------------------
@router.post("", response_model=TenantOut)
async def create_tenant(
    payload: TenantCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Create tenant + OWNER membership.
    IMPORTANT: Enforces "one owned tenant per user" (user can still join other tenants via invitations).
    """
    if payload.accepted_terms is not True:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="accepted_terms must be true to create a tenant",
        )

    # ✅ One owned tenant per user (OWNER membership)
    owned_stmt = (
        select(func.count())
        .select_from(TenantMembership)
        .where(TenantMembership.user_id == user.id)
        .where(TenantMembership.is_active.is_(True))
        .where(TenantMembership.role == "OWNER")
    )
    owned_count = int((await db.execute(owned_stmt)).scalar_one())
    if owned_count >= 1:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "tenant_limit_reached",
                "message": "Your account can own only one tenant. If you need another tenant, contact support.",
                "limit": 1,
            },
        )

    # --- Sales attribution (optional) ---
    normalized_code = normalize_referral_code(getattr(payload, "referral_code", None))

    salesperson_profile = None
    if normalized_code:
        salesperson_profile = await resolve_salesperson_by_referral_code(db, normalized_code)
        if salesperson_profile is None:
            raise HTTPException(status_code=400, detail="Invalid referral_code")

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
        role="OWNER",  # Conceptually your "MANAGER/tenant owner"
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
    User may be a member of many tenants, but may OWN only one.
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
    _membership: TenantMembership = Depends(require_permissions(PERM.TENANT_WRITE)),
):
    return {"ok": True}


# =========================================================
# TENANT MEMBERS
# =========================================================
@router.get("/members", response_model=List[TenantMemberOut])
async def list_tenant_members(
    db: AsyncSession = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
    _membership: TenantMembership = Depends(require_permissions(PERM.TENANT_MEMBERS_READ)),
):
    stmt = (
        select(TenantMembership, User)
        .join(User, User.id == TenantMembership.user_id)
        .where(TenantMembership.tenant_id == tenant.id)
        .order_by(TenantMembership.created_at.asc())
    )
    res = await db.execute(stmt)
    rows = res.all()

    out: list[TenantMemberOut] = []
    for mem, user in rows:
        out.append(
            TenantMemberOut(
                tenant_id=str(mem.tenant_id),
                user_id=str(mem.user_id),
                email=user.email,
                name=getattr(user, "name", None),
                role=_role_normalize(mem.role),
                permissions=mem.permissions or [],
                is_active=bool(mem.is_active),
                created_at=mem.created_at,
            )
        )
    return out


@router.patch("/members/{member_user_id}", response_model=TenantMemberOut)
async def update_tenant_member(
    member_user_id: uuid.UUID,
    payload: TenantMemberUpdate,
    db: AsyncSession = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
    actor: User = Depends(get_current_user),
    actor_membership: TenantMembership = Depends(get_current_membership),
    _rbac: TenantMembership = Depends(require_permissions(PERM.TENANT_MEMBERS_WRITE)),
):
    """
    Update a member inside the current tenant.
    - OWNER/ADMIN can manage.
    - Cannot deactivate self.
    - Cannot demote/deactivate the last OWNER.
    - Only OWNER can change another OWNER’s role (strict hardening).
    """
    actor_role = _role_normalize(actor_membership.role)
    if actor_role not in {"OWNER", "ADMIN"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    target = (
        await db.execute(
            select(TenantMembership)
            .where(
                TenantMembership.tenant_id == tenant.id,
                TenantMembership.user_id == member_user_id,
            )
            .with_for_update()
        )
    ).scalar_one_or_none()

    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

    # Self-protection
    if member_user_id == actor.id and payload.is_active is False:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="You cannot deactivate yourself")

    allowed_roles = {"OWNER", "ADMIN", "MANAGER", "STAFF"}

    # Role change handling
    if payload.role is not None:
        new_role = _role_normalize(payload.role)
        if new_role not in allowed_roles:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid role")

        current_role = _role_normalize(target.role)

        # Only OWNER can change an OWNER
        if current_role == "OWNER" and actor_role != "OWNER":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only an OWNER can change another OWNER",
            )

        # If demoting an OWNER, ensure not last OWNER
        if current_role == "OWNER" and new_role != "OWNER":
            owners_count = (
                await db.execute(
                    select(func.count())
                    .select_from(TenantMembership)
                    .where(TenantMembership.tenant_id == tenant.id)
                    .where(TenantMembership.is_active.is_(True))
                    .where(TenantMembership.role == "OWNER")
                )
            ).scalar_one()
            if int(owners_count) <= 1:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Cannot demote the last OWNER",
                )

        target.role = new_role

    # Active/deactivate handling
    if payload.is_active is not None:
        # If deactivating an OWNER, ensure not last OWNER
        if payload.is_active is False and _role_normalize(target.role) == "OWNER":
            owners_count = (
                await db.execute(
                    select(func.count())
                    .select_from(TenantMembership)
                    .where(TenantMembership.tenant_id == tenant.id)
                    .where(TenantMembership.is_active.is_(True))
                    .where(TenantMembership.role == "OWNER")
                )
            ).scalar_one()
            if int(owners_count) <= 1:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Cannot deactivate the last OWNER",
                )

        target.is_active = bool(payload.is_active)

    await db.commit()

    # Return enriched response (membership + user)
    row = (
        await db.execute(
            select(TenantMembership, User)
            .join(User, User.id == TenantMembership.user_id)
            .where(TenantMembership.tenant_id == tenant.id)
            .where(TenantMembership.user_id == member_user_id)
        )
    ).first()

    if row is None:
        raise HTTPException(status_code=500, detail="Failed to load updated member")

    mem, user = row
    return TenantMemberOut(
        tenant_id=str(mem.tenant_id),
        user_id=str(mem.user_id),
        email=user.email,
        name=getattr(user, "name", None),
        role=_role_normalize(mem.role),
        permissions=mem.permissions or [],
        is_active=bool(mem.is_active),
        created_at=mem.created_at,
    )