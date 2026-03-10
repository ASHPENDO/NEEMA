from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


SocialPlatformLiteral = Literal["facebook", "instagram", "tiktok", "whatsapp"]
SocialAccountTypeLiteral = Literal[
    "page",
    "instagram_business",
    "whatsapp_business_account",
    "ad_account",
    "unknown",
]


class SocialConnectionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    connected_by_user_id: UUID | None = None

    platform: SocialPlatformLiteral
    provider_account_id: str | None = None
    provider_account_name: str | None = None

    token_expires_at: datetime | None = None
    scopes: list[Any] = Field(default_factory=list)
    connection_metadata: dict[str, Any] = Field(default_factory=dict)

    is_active: bool
    created_at: datetime
    updated_at: datetime


class SocialPlatformAccountOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    social_connection_id: UUID
    tenant_id: UUID

    platform: SocialPlatformLiteral
    account_type: SocialAccountTypeLiteral | str

    provider_account_id: str
    provider_account_name: str | None = None
    username: str | None = None

    token_expires_at: datetime | None = None
    account_metadata: dict[str, Any] = Field(default_factory=dict)

    is_selected: bool
    is_active: bool

    created_at: datetime
    updated_at: datetime


class SocialConnectRequest(BaseModel):
    redirect_uri: str | None = None


class SocialConnectResponse(BaseModel):
    platform: SocialPlatformLiteral
    authorize_url: str
    state: str
    tier: str


class SocialCallbackResponse(BaseModel):
    success: bool
    platform: SocialPlatformLiteral
    connection_id: UUID
    provider_account_name: str | None = None
    message: str


class SocialDisconnectResponse(BaseModel):
    success: bool
    platform: SocialPlatformLiteral
    message: str


class SocialRefreshResponse(BaseModel):
    success: bool
    platform: SocialPlatformLiteral
    message: str


class SocialPlatformAccountSelectRequest(BaseModel):
    platform_account_id: UUID


class SocialPlatformAccountSelectResponse(BaseModel):
    success: bool
    platform_account_id: UUID
    message: str