from __future__ import annotations

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class PlatformInviteCreate(BaseModel):
    email: EmailStr
    invitee_type: str = Field(..., description="STAFF or SALESPERSON")
    role: Optional[str] = Field(None, description="For STAFF only; must be STAFF")
    permissions: Optional[List[str]] = Field(
        default_factory=list,
        description="STAFF checkbox delegations",
    )


class PlatformInviteOut(BaseModel):
    # ✅ FIX: UUID, not str
    id: UUID

    email: EmailStr
    invitee_type: str
    role: str
    permissions: List[str] = []
    token: str
    expires_at: datetime
    accepted_at: Optional[datetime] = None
    created_at: datetime

    # ✅ Pydantic v2 style
    model_config = ConfigDict(from_attributes=True)


class PlatformInviteAccept(BaseModel):
    token: str
    accept_tos: bool
    accept_notifications: bool = False


class SalespersonProfileOut(BaseModel):
    user_id: str
    referral_code: str
    is_active: bool


class PlatformInviteAcceptOut(BaseModel):
    ok: bool
    user_id: str
    role: str
    permissions: List[str] = []
    accepted_terms: bool
    notifications_opt_in: bool
    salesperson_profile: Optional[SalespersonProfileOut] = None


class PlatformMembershipOut(BaseModel):
    user_id: str
    role: str
    permissions: List[str] = []
    is_active: bool
    accepted_terms: bool
    notifications_opt_in: bool

    model_config = ConfigDict(from_attributes=True)


class AssignSalespersonPayment(BaseModel):
    amount: int = Field(..., gt=0)
    phone: str = Field(..., description="MSISDN for STK push, e.g. 2547XXXXXXXX")
