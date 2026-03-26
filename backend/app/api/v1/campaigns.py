from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.campaign import CampaignCreate, CampaignResponse
from app.services.campaign_service import CampaignService
from app.api.dependencies import get_db, get_current_user

router = APIRouter(prefix="/campaigns", tags=["Campaigns"])


@router.post("/", response_model=CampaignResponse)
async def create_campaign(
    payload: CampaignCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    service = CampaignService(db)

    campaign = await service.create_campaign(
        tenant_id=user.tenant_id,
        data=payload
    )

    return campaign