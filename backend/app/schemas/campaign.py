from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from uuid import UUID


# ==============================
# CREATE SCHEMA (UPDATED)
# ==============================
class CampaignCreate(BaseModel):
    # ✅ Backward compatibility (single product)
    product_id: Optional[UUID] = None

    # ✅ NEW: multi-product support
    product_ids: Optional[List[UUID]] = None

    template_id: Optional[str] = None

    caption: str

    # ✅ Single (existing)
    media_url: Optional[str] = None

    # ✅ NEW: multi-media (scrollable posts)
    media_urls: Optional[List[str]] = None

    # MVP defaults handled in service
    platforms: Optional[List[str]] = None
    page_ids: Optional[List[str]] = None

    scheduled_at: Optional[datetime] = None
    name: Optional[str] = None


# ==============================
# RESPONSE SCHEMA (UPDATED)
# ==============================
class CampaignResponse(BaseModel):
    id: UUID

    # ✅ Keep for backward compatibility
    product_id: Optional[UUID]

    # ✅ NEW: multi-product visibility
    product_ids: Optional[List[UUID]]

    template_id: Optional[str]

    caption: str

    # ✅ Single
    media_url: Optional[str]

    # ✅ NEW: multi
    media_urls: Optional[List[str]]

    status: str
    scheduled_at: Optional[datetime]

    class Config:
        from_attributes = True