from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, Field, HttpUrl
from pydantic.config import ConfigDict


class CatalogItemBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    title: str = Field(..., min_length=1, max_length=255)
    sku: Optional[str] = Field(None, max_length=128)
    description: Optional[str] = None

    price_amount: Decimal = Field(..., gt=0)
    price_currency: str = Field(default="KES", min_length=1, max_length=8)


class CatalogItemCreate(CatalogItemBase):
    pass


class CatalogItemUpdate(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    title: Optional[str] = Field(None, min_length=1, max_length=255)
    sku: Optional[str] = Field(None, max_length=128)
    description: Optional[str] = None

    price_amount: Optional[Decimal] = Field(None, gt=0)
    price_currency: Optional[str] = Field(None, min_length=1, max_length=8)
    status: Optional[str] = Field(None, max_length=32)


class CatalogItemResponse(CatalogItemBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    created_by_user_id: Optional[uuid.UUID] = None
    status: str

    created_at: datetime
    updated_at: datetime


# ------------------------------------------------------------------
# Website scraping ingestion schemas
# ------------------------------------------------------------------

class CatalogScrapeRequest(BaseModel):
    url: HttpUrl

    max_items: int = Field(default=30, ge=1, le=200)
    default_currency: str = Field(default="KES", min_length=1, max_length=8)

    crawl_product_pages: bool = Field(default=True)
    max_product_pages: int = Field(default=60, ge=1, le=500)

    try_woocommerce_store_api: bool = Field(default=True)
    try_shopify_product_json: bool = Field(default=True)

    allow_fallback: bool = Field(default=False)
    fallback_price_amount: Optional[Decimal] = Field(default=None, gt=0)
    fallback_price_currency: Optional[str] = Field(default=None, min_length=1, max_length=8)


class CatalogScrapeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    source_url: str
    created: List[CatalogItemResponse]
    skipped: int = 0

    mode_used: str = "unknown"
    discovered_product_links: int = 0
    fetched_product_pages: int = 0

    blocked: bool = False
    blocked_status_code: Optional[int] = None
    blocked_hint: Optional[str] = None