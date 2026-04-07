from pydantic import BaseModel
from typing import Optional, List


class PostPayload(BaseModel):
    caption: str
    image_url: Optional[str] = None

    # Single target (legacy / required)
    page_id: Optional[str] = None
    platform: Optional[str] = None

    # Multi-target (preferred)
    page_ids: Optional[List[str]] = None
    platforms: Optional[List[str]] = None

    # ✅ CRITICAL FIX (DO NOT REMOVE)
    campaign_id: Optional[str] = None