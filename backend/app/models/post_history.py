# app/models/post_history.py

import uuid
from sqlalchemy import Column, String, Text, DateTime, Enum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime

from app.db.base import Base


class PostStatusEnum(str, Enum):
    pending = "pending"
    success = "success"
    failed = "failed"


class PostHistory(Base):
    __tablename__ = "post_history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    platform = Column(String, nullable=False)

    page_id = Column(String, nullable=True)

    caption = Column(Text, nullable=False)
    image_url = Column(Text, nullable=True)

    status = Column(String, default="pending")

    external_post_id = Column(String, nullable=True)  # Facebook post ID

    error_message = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    posted_at = Column(DateTime, nullable=True)