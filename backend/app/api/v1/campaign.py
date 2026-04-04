from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.campaign import CampaignCreate, CampaignResponse
from app.services.campaign_service import CampaignService
from app.db.session import get_db

router = APIRouter()


@router.post("/", response_model=CampaignResponse)
async def create_campaign_endpoint(
    payload: CampaignCreate,
    db: AsyncSession = Depends(get_db),
):
    # TODO: Replace with real tenant extraction
    tenant_id = "00000000-0000-0000-0000-000000000000"

    campaign = await CampaignService.create_campaign(db, tenant_id, payload)
    return campaign