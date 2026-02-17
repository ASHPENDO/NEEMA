# app/schemas/sales.py
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class EarningEventOut(BaseModel):
    id: str
    salesperson_profile_id: str
    tenant_id: Optional[str] = None

    event_type: str
    currency: str
    gross_amount: Decimal
    commission_amount: Decimal
    source: str

    occurred_at: datetime
    created_at: datetime

    event_metadata: Dict[str, Any] = Field(default_factory=dict)

    class Config:
        from_attributes = True


class EarningsPageOut(BaseModel):
    items: List[EarningEventOut]
    limit: int
    offset: int
    total: int


class SalesStatsOut(BaseModel):
    salesperson_profile_id: str

    total_events: int
    total_commission: Decimal

    last_30d_events: int
    last_30d_commission: Decimal

    last_event_at: Optional[datetime] = None
