# app/models/social_account.py

from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Boolean, Enum
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid
import enum

from app.db.base import Base


class SocialAccountStatus(str, enum.Enum):
    ACTIVE = "active"
    DISCONNECTED = "disconnected"


class SocialAccount(Base):
    __tablename__ = "social_accounts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)

    platform = Column(String, default="facebook", nullable=False)

    # Facebook user (optional)
    meta_user_id = Column(String, nullable=True)

    # PAGE TOKEN (source of truth)
    page_access_token = Column(Text, nullable=False)

    token_expires_at = Column(DateTime, nullable=True)

    page_id = Column(String, nullable=False)
    page_name = Column(String, nullable=True)

    # 🔥 NEW HEALTH FIELDS
    status = Column(
        Enum(SocialAccountStatus),
        default=SocialAccountStatus.ACTIVE,
        nullable=False
    )

    requires_reauth = Column(Boolean, default=False, nullable=False)

    last_error = Column(Text, nullable=True)

    last_checked_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)