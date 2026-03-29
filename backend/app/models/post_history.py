# app/models/post_history.py

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, Text, DateTime, Integer, Index
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base


class PostHistory(Base):
    __tablename__ = "post_history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    platform = Column(String, nullable=False)

    page_id = Column(String, nullable=True)

    caption = Column(Text, nullable=False)
    image_url = Column(Text, nullable=True)

    status = Column(String, default="pending")

    external_post_id = Column(String, nullable=True)

    error_message = Column(Text, nullable=True)

    # 🔥 FAILURE + RETRY TRACKING
    failure_reason = Column(Text, nullable=True)
    retry_count = Column(Integer, default=0, nullable=False)
    last_attempt_at = Column(DateTime(timezone=True), nullable=True)

    # 🔥 IDEMPOTENCY (CRITICAL)
    idempotency_key = Column(String, nullable=True, index=True)

    # UTC-aware timestamps
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )

    posted_at = Column(
        DateTime(timezone=True),
        nullable=True
    )


# 🔥 COMPOSITE INDEX (FAST LOOKUP FOR IDEMPOTENCY)
Index(
    "ix_post_history_idem_lookup",
    PostHistory.tenant_id,
    PostHistory.platform,
    PostHistory.page_id,
    PostHistory.idempotency_key,
)