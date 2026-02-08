# backend/app/api/v1/tenants.py

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.api.v1.auth import get_current_user  # adjust import if needed
from app.models.user import User
from app.models.tenant import Tenant
from app.models.tenant_membership import TenantMembership
from app.schemas.tenant import TenantCreate, TenantOut

router = APIRouter(prefix="/tenants", tags=["tenants"])


@router.post("", response_model=TenantOut)
async def create_tenant(
    payload: TenantCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # Enforce required ToS acceptance at tenant creation time
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
    )

    # Store onboarding fields on membership if the model supports them
    # (Safe for now even if columns haven't been migrated yet.)
    if hasattr(membership, "accepted_terms"):
        setattr(membership, "accepted_terms", True)
    if hasattr(membership, "accepted_tos"):
        setattr(membership, "accepted_tos", True)
    if hasattr(membership, "accept_tos"):
        setattr(membership, "accept_tos", True)

    if payload.notifications_opt_in is not None:
        if hasattr(membership, "notifications_opt_in"):
            setattr(membership, "notifications_opt_in", payload.notifications_opt_in)
        if hasattr(membership, "accept_notifications"):
            setattr(membership, "accept_notifications", payload.notifications_opt_in)
        if hasattr(membership, "accepted_notifications"):
            setattr(membership, "accepted_notifications", payload.notifications_opt_in)

    if payload.referral_code:
        if hasattr(membership, "referral_code"):
            setattr(membership, "referral_code", payload.referral_code)

    db.add(membership)
    await db.commit()
    await db.refresh(tenant)
    return tenant
