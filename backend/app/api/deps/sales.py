from __future__ import annotations

from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth import get_current_user
from app.db.session import get_db
from app.models.salesperson_profile import SalespersonProfile
from app.models.user import User


async def require_salesperson(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SalespersonProfile:
    sp = (await db.execute(select(SalespersonProfile).where(SalespersonProfile.user_id == user.id))).scalar_one_or_none()
    if sp is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a salesperson")
    if sp.is_active is not True:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Salesperson account is inactive")
    return sp
