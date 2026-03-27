from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.models.user import User
from app.models.tenant_membership import TenantMembership


class CurrentUser:
    def __init__(self, user: User, tenant_id):
        self.user = user
        self.tenant_id = tenant_id


async def get_current_user(
    db: AsyncSession = Depends(get_db),
) -> CurrentUser:
    """
    TEMP: fetch first user + tenant membership
    """

    # 1. Get user
    result = await db.execute(select(User).limit(1))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not authenticated",
        )

    # 2. Get tenant membership
    result = await db.execute(
        select(TenantMembership).where(
            TenantMembership.user_id == user.id
        )
    )
    membership = result.scalar_one_or_none()

    if not membership:
        raise HTTPException(
            status_code=400,
            detail="User has no tenant",
        )

    return CurrentUser(user=user, tenant_id=membership.tenant_id)


__all__ = ["get_db", "get_current_user"]