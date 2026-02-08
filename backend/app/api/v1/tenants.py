# backend/app/api/v1/tenants.py

from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

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
    db.add(membership)
    await db.commit()
    await db.refresh(tenant)
    return tenant
