# backend/app/schemas/tenant.py

from pydantic import BaseModel, Field
from typing import List, Optional
from uuid import UUID


class TenantCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    tier: str = Field(default="sungura")

    # Onboarding / compliance fields
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
        description="Optional: referral code used during onboarding.",
        max_length=64,
    )


class TenantOut(BaseModel):
    id: UUID
    name: str
    tier: str
    is_active: bool

    class Config:
        from_attributes = True


class TenantInviteCreate(BaseModel):
    email: str
    role: str = "STAFF"
    permissions: List[str] = []


class TenantInviteOut(BaseModel):
    id: UUID
    tenant_id: UUID
    email: str
    role: str
    permissions: List[str]
    token: str
    expires_at: str

    class Config:
        from_attributes = True


class AcceptTenantInvite(BaseModel):
    accept_tos: bool = True
    accept_notifications: Optional[bool] = None
