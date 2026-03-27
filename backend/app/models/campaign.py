# app/models/campaign.py

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID, JSON

from app.db.base import Base


class Campaign(Base):
    __tablename__ = "campaigns"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    tenant_id = Column(UUID(as_uuid=True), nullable=False)

    name = Column(String, nullable=False)

    # MULTI-PLATFORM SUPPORT
    platforms = Column(JSON, nullable=False)  # ["facebook", "instagram"]

    # MULTI-PAGE SUPPORT
    page_ids = Column(JSON, nullable=False)  # ["page1", "page2"]

    caption = Column(Text, nullable=False)
    media_url = Column(Text, nullable=True)

    # ✅ TIMEZONE-AWARE
    scheduled_at = Column(DateTime(timezone=True), nullable=False)

    # EXECUTION TRACKING
    status = Column(String, default="scheduled")  
    # scheduled | processing | posted | failed

    # ✅ USE UTC-AWARE DEFAULT
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )