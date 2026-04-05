from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.api.dependencies import get_current_user

from app.models.campaign import Campaign
from app.models.post_history import PostHistory


router = APIRouter(prefix="/campaigns", tags=["Campaigns"])


# ==================================================
# 📌 LIST CAMPAIGNS
# ==================================================
@router.get("/")
async def list_campaigns(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    result = await db.execute(
        select(Campaign)
        .where(Campaign.tenant_id == current_user.tenant_id)
        .order_by(Campaign.created_at.desc())
    )

    campaigns = result.scalars().all()

    return campaigns


# ==================================================
# 📌 GET SINGLE CAMPAIGN
# ==================================================
@router.get("/{campaign_id}")
async def get_campaign(
    campaign_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    campaign = await db.get(Campaign, campaign_id)

    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    # 🔐 Tenant isolation
    if campaign.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    return campaign


# ==================================================
# 📌 CAMPAIGN POST HISTORY
# ==================================================
@router.get("/{campaign_id}/history")
async def campaign_history(
    campaign_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    # Validate campaign exists + tenant access
    campaign = await db.get(Campaign, campaign_id)

    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    if campaign.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    result = await db.execute(
        select(PostHistory)
        .where(PostHistory.campaign_id == campaign_id)
        .order_by(PostHistory.created_at.desc())
    )

    history = result.scalars().all()

    return history