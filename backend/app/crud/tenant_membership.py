# app/crud/tenant_membership.py
from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tenant_membership import TenantMembership


async def count_active_staff_memberships(db: AsyncSession, tenant_id: uuid.UUID) -> int:
    """
    Counts ACTIVE STAFF memberships for a tenant.
    Roles in this project are stored as uppercase strings: "OWNER", "ADMIN", "STAFF".
    """
    stmt = (
        select(func.count(TenantMembership.id))
        .where(TenantMembership.tenant_id == tenant_id)
        .where(TenantMembership.is_active.is_(True))
        .where(TenantMembership.role == "STAFF")
    )
    res = await db.execute(stmt)
    return int(res.scalar() or 0)


async def count_active_staff_memberships_excluding_user(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    exclude_user_id: uuid.UUID,
) -> int:
    """
    Same as count_active_staff_memberships but excludes a specific user_id.
    Prevents blocking re-accept/reactivation of an already-counted active STAFF user.
    """
    stmt = (
        select(func.count(TenantMembership.id))
        .where(TenantMembership.tenant_id == tenant_id)
        .where(TenantMembership.is_active.is_(True))
        .where(TenantMembership.role == "STAFF")
        .where(TenantMembership.user_id != exclude_user_id)
    )
    res = await db.execute(stmt)
    return int(res.scalar() or 0)
