# backend/app/core/tenant_rbac.py

from uuid import UUID

from fastapi import Header, HTTPException, status, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.models.tenant_membership import TenantMembership
from app.api.v1.auth import get_current_user  # adjust if your get_current_user is elsewhere
from app.models.user import User


async def get_tenant_id(x_tenant_id: str = Header(..., alias="X-Tenant-Id")) -> UUID:
    try:
        return UUID(x_tenant_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="X-Tenant-Id must be a valid UUID")


async def get_active_membership(
    tenant_id: UUID = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> TenantMembership:
    stmt = select(TenantMembership).where(
        TenantMembership.tenant_id == tenant_id,
        TenantMembership.user_id == user.id,
        TenantMembership.is_active.is_(True),
    )
    membership = (await db.execute(stmt)).scalar_one_or_none()
    if not membership:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this tenant")
    return membership


def require_permissions(*required: str):
    async def _checker(membership: TenantMembership = Depends(get_active_membership)) -> TenantMembership:
        # OWNER and ADMIN bypass
        if membership.role in {"OWNER", "ADMIN"}:
            return membership

        have = set(membership.permissions or [])
        need = set(required)
        if not need.issubset(have):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing permissions: {sorted(list(need - have))}",
            )
        return membership

    return _checker
