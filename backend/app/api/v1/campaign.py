# app/api/v1/campaigns.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.schemas.campaign import CampaignCreate, CampaignResponse
from app.services.campaign_service import CampaignService
from app.db.session import get_db
from app.models.social_account import SocialAccount
from app.models.tenant import Tenant
from app.api.deps.tenant import require_active_subscription

router = APIRouter()


@router.post("/", response_model=CampaignResponse)
async def create_campaign_endpoint(
    payload: CampaignCreate,
    db: AsyncSession = Depends(get_db),
    tenant: Tenant = Depends(require_active_subscription),  # ✅ paywall
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

    if not social_account:
        raise HTTPException(
            status_code=400,
            detail="Invalid page_id for this tenant"
        )

    # ✅ Guard: ensure the page belongs to the authenticated tenant
    # (prevents a user from creating campaigns on another tenant's pages)
    if social_account.tenant_id != tenant.id:
        raise HTTPException(
            status_code=403,
            detail="page_id does not belong to your tenant",
        )

    # ==============================
    # CREATE CAMPAIGN
    # ==============================
    campaign = await CampaignService.create_campaign(
        db,
        tenant.id,  # use tenant from dep, not from social_account
        payload,
    )

    return campaign