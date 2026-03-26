# app/services/posting/schemas.py

from pydantic import BaseModel, HttpUrl
from typing import Optional


class PostPayload(BaseModel):
    platform: str  # "facebook", "instagram", "tiktok"
    page_id: Optional[str] = None
    caption: str
    image_url: Optional[HttpUrl] = None