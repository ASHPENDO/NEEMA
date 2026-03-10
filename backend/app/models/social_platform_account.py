from __future__ import annotations

import uuid

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.sql import func

from app.db.base import Base


class SocialPlatformAccount(Base):
    __tablename__ = "social_platform_accounts"

    __table_args__ = (
        UniqueConstraint(
            "social_connection_id",
            "provider_account_id",
            name="uq_social_platform_accounts_connection_provider_account",
        ),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    social_connection_id = Column(
        UUID(as_uuid=True),
        ForeignKey("social_connections.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    tenant_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    platform = Column(String(32), nullable=False, index=True)
    account_type = Column(String(64), nullable=False, default="page")

    provider_account_id = Column(String(255), nullable=False)
    provider_account_name = Column(String(255), nullable=True)
    username = Column(String(255), nullable=True)

    access_token = Column(Text, nullable=True)
    token_expires_at = Column(DateTime(timezone=True), nullable=True)

    account_metadata = Column(JSONB, nullable=False, default=dict)

    is_selected = Column(Boolean, nullable=False, default=False, server_default="false")
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())