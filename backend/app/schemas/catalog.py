from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field


class CatalogItemBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    sku: Optional[str] = Field(None, max_length=128)
    description: Optional[str] = None

    price_amount: Decimal = Field(..., gt=0)
    price_currency: str = Field(default="KES", min_length=1, max_length=8)


class CatalogItemCreate(CatalogItemBase):
    pass


class CatalogItemUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    sku: Optional[str] = Field(None, max_length=128)
    description: Optional[str] = None

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

    class Config:
        orm_mode = True