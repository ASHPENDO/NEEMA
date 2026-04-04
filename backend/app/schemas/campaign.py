from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from uuid import UUID


class CampaignCreate(BaseModel):
    product_id: UUID
    template_id: str

    caption: str
    media_url: Optional[str] = None

    # MVP defaults handled in service
    platforms: Optional[List[str]] = None
    page_ids: Optional[List[str]] = None

    scheduled_at: Optional[datetime] = None
    name: Optional[str] = None


class CampaignResponse(BaseModel):
    id: UUID
    product_id: UUID
    template_id: str

    caption: str
    media_url: Optional[str]

    status: str
    scheduled_at: Optional[datetime]

    class Config:
        from_attributes = True