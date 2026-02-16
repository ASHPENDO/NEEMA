from datetime import datetime
from typing import List, Optional
from uuid import UUID
import re

from pydantic import BaseModel, Field, EmailStr, field_validator


REFERRAL_REGEX = re.compile(r"^[A-Z0-9]{6}$")


class TenantCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    tier: str = Field(default="sungura")

    accepted_terms: bool = Field(
        ...,
        description="Must be true to create a tenant (ToS acceptance is required).",
    )

    notifications_opt_in: Optional[bool] = Field(
        default=None,
        description="Optional: whether the user opts in to notifications.",
    )

    referral_code: Optional[str] = Field(
        default=None,
        description="Optional: 6-character alphanumeric referral code.",
        min_length=6,
        max_length=6,
    )

    @field_validator("referral_code")
    @classmethod
    def validate_referral_code(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None

        v = v.strip().upper()

        if not REFERRAL_REGEX.match(v):
            raise ValueError("Referral code must be exactly 6 uppercase letters or digits")

        return v


class TenantOut(BaseModel):
    id: UUID
    name: str
    tier: str
    is_active: bool

    model_config = {"from_attributes": True}


class TenantInviteCreate(BaseModel):
    email: EmailStr
    role: str = Field(default="STAFF")
    permissions: List[str] = Field(default_factory=list)


class TenantInviteOut(BaseModel):
    id: UUID
    tenant_id: UUID
    email: EmailStr
    role: str
    permissions: List[str]
    token: str
    expires_at: datetime

    model_config = {"from_attributes": True}


class AcceptTenantInvite(BaseModel):
    accept_tos: bool = True
    accept_notifications: Optional[bool] = None
