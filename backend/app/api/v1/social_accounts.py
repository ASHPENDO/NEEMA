from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.api.dependencies import get_current_user
from app.models.social_account import SocialAccount

router = APIRouter(prefix="/social-accounts", tags=["Social Accounts"])


@router.get("/")
async def list_social_accounts(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    result = await db.execute(
        select(SocialAccount)
        .where(SocialAccount.tenant_id == current_user.tenant_id)
    )
    return result.scalars().all()