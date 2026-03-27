from pydantic import BaseModel, HttpUrl, field_validator
from datetime import datetime
from typing import List
from uuid import UUID


class CampaignCreate(BaseModel):
    name: str
    caption: str
    media_url: HttpUrl
    platforms: List[str]
    scheduled_at: datetime
    page_ids: List[str]

    @field_validator("scheduled_at")
    @classmethod
    def normalize_datetime(cls, v: datetime) -> datetime:
        if v.tzinfo is not None:
            return v.astimezone().replace(tzinfo=None)
        return v


class CampaignResponse(BaseModel):
    id: str
    name: str
    status: str
    scheduled_at: datetime

    # ✅ Convert UUID → string automatically
    @field_validator("id", mode="before")
    @classmethod
    def convert_uuid(cls, v):
        if isinstance(v, UUID):
            return str(v)
        return v

    class Config:
        from_attributes = True