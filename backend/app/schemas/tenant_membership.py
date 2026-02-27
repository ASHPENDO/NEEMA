from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class TenantMemberOut(BaseModel):
    tenant_id: str
    user_id: str
    email: str
    name: Optional[str] = None
    role: str
    permissions: List[str] = []
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class TenantMemberUpdate(BaseModel):
    # Optional updates; send one or both
    role: Optional[str] = None
    is_active: Optional[bool] = None