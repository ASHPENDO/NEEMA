# app/models/campaign.py

import uuid
from sqlalchemy import Column, String, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime

from app.db.base import Base


class Campaign(Base):
    __tablename__ = "campaigns"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    tenant_id = Column(UUID(as_uuid=True), nullable=False)

    name = Column(String, nullable=False)

    platform = Column(String, nullable=False)
    page_id = Column(String, nullable=True)

    caption = Column(Text, nullable=False)
    image_url = Column(Text, nullable=True)

    scheduled_at = Column(DateTime, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)