# app/models/social_account.py

from sqlalchemy import Column, String, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid

from app.db.base import Base


class SocialAccount(Base):
    __tablename__ = "social_accounts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)

    platform = Column(String, default="facebook", nullable=False)

    # Facebook user (optional but useful)
    meta_user_id = Column(String, nullable=True)

    # 🔥 ONLY TOKEN WE KEEP (PAGE TOKEN)
    page_access_token = Column(Text, nullable=False)

    token_expires_at = Column(DateTime, nullable=True)

    page_id = Column(String, nullable=False)
    page_name = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)