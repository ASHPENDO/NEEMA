from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid

from app.db.base import Base


class SocialAccount(Base):
    __tablename__ = "social_accounts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"))

    platform = Column(String, default="facebook")

    meta_user_id = Column(String)
    access_token = Column(String)
    token_expires_at = Column(DateTime)

    page_id = Column(String)
    page_name = Column(String)
    page_access_token = Column(String)

    created_at = Column(DateTime, default=datetime.utcnow)