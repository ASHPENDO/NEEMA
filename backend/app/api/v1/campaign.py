from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.schemas.campaign import CampaignCreate, CampaignResponse
from app.services.campaign_service import CampaignService
from app.db.session import get_db
from app.models.social_account import SocialAccount

router = APIRouter()

@router.post("/", response_model=CampaignResponse)
async def create_campaign_endpoint(
    payload: CampaignCreate,
    db: AsyncSession = Depends(get_db),
):
    # ==============================
    # 🔥 DERIVE TENANT FROM PAGE_ID
    # ==============================
    if not payload.page_ids or len(payload.page_ids) == 0:
        raise HTTPException(status_code=400, detail="page_ids required")

    page_id = payload.page_ids[0]

    result = await db.execute(
        select(SocialAccount).where(SocialAccount.page_id == page_id)
    )
    social_account = result.scalar_one_or_none()

    # after fetching social_account
    if not social_account:
        raise HTTPException(
            status_code=400,
            detail="Invalid page_id for this tenant"
        )

    tenant_id = social_account.tenant_id

    # ==============================
    # CREATE CAMPAIGN
    # ==============================
    campaign = await CampaignService.create_campaign(
        db,
        tenant_id,
        payload,
    )

    return campaign