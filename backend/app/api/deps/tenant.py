import uuid
from typing import Optional

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.api.v1.auth import get_current_user
from app.models.user import User
from app.models.tenant import Tenant
from app.models.tenant_membership import TenantMembership

ALLOWED_TENANT_ROLES = {"OWNER", "ADMIN", "STAFF"}


async def get_current_tenant(
    x_tenant_id: Optional[str] = Header(default=None, alias="X-Tenant-Id"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Tenant:
    """
    Resolve tenant from X-Tenant-Id header and ensure current user has an active membership.
    """
    if not x_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="X-Tenant-Id header is required",
        )

    try:
        tenant_uuid = uuid.UUID(x_tenant_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="X-Tenant-Id must be a valid UUID",
        )

    tenant = await db.get(Tenant, tenant_uuid)
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found",
        )

    stmt = select(TenantMembership).where(
        TenantMembership.tenant_id == tenant.id,
        TenantMembership.user_id == user.id,
        TenantMembership.is_active.is_(True),
    )
    membership = (await db.execute(stmt)).scalar_one_or_none()
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this tenant",
        )

    return tenant


async def get_current_membership(
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> TenantMembership:
    """
    Fetch the active membership for (user, tenant). Safe after get_current_tenant.
    """
    stmt = select(TenantMembership).where(
        TenantMembership.tenant_id == tenant.id,
        TenantMembership.user_id == user.id,
        TenantMembership.is_active.is_(True),
    )
    membership = (await db.execute(stmt)).scalar_one()
    return membership


def require_tenant_roles(*allowed_roles: str):
    """
    Enforce membership.role is in allowed_roles. (OWNER/ADMIN/STAFF)
    """
    allowed = {r.upper() for r in allowed_roles}
    unknown = allowed - ALLOWED_TENANT_ROLES
    if unknown:
        raise ValueError(
            f"Unknown tenant role(s): {sorted(unknown)}. Allowed: {sorted(ALLOWED_TENANT_ROLES)}"
        )

    async def _checker(
        membership: TenantMembership = Depends(get_current_membership),
    ) -> TenantMembership:
        role = (membership.role or "").upper()
        if role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient role: {role}. Allowed: {', '.join(sorted(allowed))}",
            )
        return membership

    return _checker
