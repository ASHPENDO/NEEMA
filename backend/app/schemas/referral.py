from __future__ import annotations

from pydantic import BaseModel, Field, constr
from typing import Optional


ReferralCode = constr(pattern=r"^[A-Z0-9]{6}$")


class ReferralValidateIn(BaseModel):
    referral_code: str = Field(..., description="6-char referral code")


class ReferralValidateOut(BaseModel):
    valid: bool

    referral_code: Optional[ReferralCode] = None
    salesperson_user_id: Optional[str] = None