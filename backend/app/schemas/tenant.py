from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, EmailStr


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
        description="Optional: referral code used during onboarding.",
        max_length=64,
    )


class TenantOut(BaseModel):
    id: UUID
    name: str
    tier: str
    is_active: bool

    # Pydantic v2
    model_config = {"from_attributes": True}


# NOTE: These invitation schemas can stay here for now, but we may move them into
# a dedicated invitations schema module when we implement tenant_invitations endpoints.
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
