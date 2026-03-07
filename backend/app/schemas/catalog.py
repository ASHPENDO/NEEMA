from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, Field, HttpUrl
from pydantic.config import ConfigDict


# ------------------------------------------------------------------
# Catalog Item CRUD
# ------------------------------------------------------------------

class CatalogItemBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    sku: Optional[str] = Field(None, max_length=128)
    description: Optional[str] = None
    image_url: Optional[str] = Field(None, max_length=2048)

    price_amount: Decimal = Field(..., gt=0)
    price_currency: str = Field(default="KES", min_length=1, max_length=8)


class CatalogItemCreate(CatalogItemBase):
    pass


class CatalogItemUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    sku: Optional[str] = Field(None, max_length=128)
    description: Optional[str] = None
    image_url: Optional[str] = Field(None, max_length=2048)

    price_amount: Optional[Decimal] = Field(None, gt=0)
    price_currency: Optional[str] = Field(None, min_length=1, max_length=8)
    status: Optional[str] = Field(None, max_length=32)


class CatalogItemResponse(CatalogItemBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    created_by_user_id: Optional[uuid.UUID] = None
    status: str

    created_at: datetime
    updated_at: datetime

    # Pydantic v2 ORM mode
    model_config = ConfigDict(from_attributes=True)


# ------------------------------------------------------------------
# Scrape ingestion (fetch URL)
# ------------------------------------------------------------------

class CatalogScrapeRequest(BaseModel):
    url: HttpUrl
    max_items: int = Field(default=20, ge=1, le=500)
    default_currency: str = Field(default="KES", min_length=1, max_length=8)

    # feature flags / knobs
    try_woocommerce_store_api: bool = Field(default=True)
    crawl_product_pages: bool = Field(default=True)
    max_product_pages: int = Field(default=80, ge=0, le=500)
    try_shopify_product_json: bool = Field(default=True)

    # last-resort fallback (single product page)
    allow_fallback: bool = Field(default=True)
    fallback_price_amount: Optional[Decimal] = Field(default=None, gt=0)
    fallback_price_currency: Optional[str] = Field(default=None, min_length=1, max_length=8)


class CatalogScrapeResponse(BaseModel):
    source_url: str
    created: List[CatalogItemResponse]
    skipped: int = 0

    mode_used: str = "unknown"
    discovered_product_links: int = 0
    fetched_product_pages: int = 0

    blocked: bool = False
    blocked_status_code: Optional[int] = None
    blocked_hint: Optional[str] = None