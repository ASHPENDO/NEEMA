# app/schemas/platform_sales.py
from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, constr

ReferralCode = constr(pattern=r"^[A-Z0-9]{6}$")  # exactly 6 chars A–Z0–9


class SalespersonCreate(BaseModel):
    """
    Create a SalespersonProfile for:
      - an existing user (user_id), OR
      - create/find user by email (email)
    Provide exactly one of user_id or email.
    """
    user_id: Optional[UUID] = None
    email: Optional[EmailStr] = None

    # optional initial payout preference field(s)
    last_payment_phone: Optional[str] = Field(default=None, max_length=32)

    def validate_choice(self) -> None:
        if (self.user_id is None and self.email is None) or (self.user_id is not None and self.email is not None):
            raise ValueError("Provide exactly one of user_id or email.")


class SalespersonUpdate(BaseModel):
    is_active: Optional[bool] = None
    last_payment_amount: Optional[int] = None
    last_payment_phone: Optional[str] = Field(default=None, max_length=32)
    last_payment_assigned_at: Optional[datetime] = None


class SalespersonOut(BaseModel):
    id: UUID
    user_id: UUID
    referral_code: ReferralCode
    is_active: bool

    last_payment_amount: Optional[int] = None
    last_payment_phone: Optional[str] = None
    last_payment_assigned_at: Optional[datetime] = None

    created_at: datetime

    class Config:
        from_attributes = True


class SalespersonListOut(BaseModel):
    items: list[SalespersonOut]
    total: int
    limit: int
    offset: int
