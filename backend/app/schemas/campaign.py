from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from uuid import UUID


# ==============================
# OPTIONAL: Lightweight Product View (for response only)
# ==============================
class CampaignProduct(BaseModel):
    id: UUID
    title: Optional[str] = None
    price_amount: Optional[float] = None
    price_currency: Optional[str] = None

    class Config:
        from_attributes = True


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

    # ✅ Backward compatibility
    product_id: Optional[UUID]

    # ✅ Multi-product
    product_ids: Optional[List[UUID]]

    template_id: Optional[str]

    caption: str

    # ✅ Single media
    media_url: Optional[str]

    # ✅ Multi media
    media_urls: Optional[List[str]]

    status: str
    scheduled_at: Optional[datetime]

    # 🔥 NEW (optional, safe)
    # Allows frontend to access price + currency for display
    products: Optional[List[CampaignProduct]] = None

    class Config:
        from_attributes = True