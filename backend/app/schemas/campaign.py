from pydantic import BaseModel, HttpUrl
from datetime import datetime
from typing import List


class CampaignCreate(BaseModel):
    name: str
    caption: str
    media_url: HttpUrl
    platforms: List[str]
    scheduled_at: datetime
    page_ids: List[str]


class CampaignResponse(BaseModel):
    id: str
    name: str
    status: str
    scheduled_at: datetime

    class Config:
        from_attributes = True