# app/api/v1/routes/social_accounts.py

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.core.security import get_current_user
from app.services.facebook_oauth_service import build_facebook_oauth_url

router = APIRouter(prefix="/social-accounts", tags=["Social Accounts"])


@router.post("/reconnect/facebook")
async def reconnect_facebook(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    reconnect_url = build_facebook_oauth_url(force_reauth=True)

    return {
        "reconnect_url": reconnect_url
    }