from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel, Field


class SalesMeOut(BaseModel):
    user_id: str
    salesperson_profile_id: str
    referral_code: str
    is_active: bool
    created_at: datetime


class SalesStatsOut(BaseModel):
    total_clients: int = Field(..., ge=0)
    active_clients: int = Field(..., ge=0)
    earnings_total: float
    earnings_currency: str
