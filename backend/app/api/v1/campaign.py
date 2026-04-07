from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone

from app.schemas.campaign import CampaignCreate, CampaignResponse
from app.services.campaign_service import CampaignService
from app.db.session import get_db

from app.api.dependencies import get_current_user  # ✅ NEW

router = APIRouter()


@router.post("/", response_model=CampaignResponse)
async def create_campaign_endpoint(
    payload: CampaignCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),  # ✅ NEW
):
    # ✅ FIX: use real tenant
    tenant_id = current_user.tenant_id

    # ✅ Ensure schedulable
    payload_dict = payload.dict()
    payload_dict["status"] = "scheduled"
    payload_dict["scheduled_at"] = datetime.now(timezone.utc)

    payload = CampaignCreate(**payload_dict)

    campaign = await CampaignService.create_campaign(db, tenant_id, payload)
    return campaign