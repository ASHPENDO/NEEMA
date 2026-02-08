# backend/app/schemas/tenant.py

from pydantic import BaseModel, Field
from typing import List, Optional
from uuid import UUID


class TenantCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    tier: str = Field(default="sungura")


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
