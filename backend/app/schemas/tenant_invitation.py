from __future__ import annotations

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class TenantInviteCreate(BaseModel):
    email: EmailStr
    role: str = Field(default="STAFF", description="ADMIN or STAFF")
    permissions: List[str] = Field(default_factory=list)


class TenantInviteOut(BaseModel):
    id: UUID
    tenant_id: UUID
    email: EmailStr
    role: str
    permissions: List[str]
    token: str
    expires_at: datetime
    accepted_at: Optional[datetime] = None
    accepted_by_user_id: Optional[UUID] = None

    model_config = {"from_attributes": True}


class AcceptTenantInvite(BaseModel):
    token: str = Field(..., description="Invitation token")
    accept_tos: bool = Field(default=True, description="Must be true to accept tenant invitation")
    accept_notifications: Optional[bool] = Field(default=None, description="Optional notifications opt-in/out")
