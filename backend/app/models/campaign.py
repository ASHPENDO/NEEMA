import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID, JSON

from app.db.base import Base


class Campaign(Base):
    __tablename__ = "campaigns"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    tenant_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    # 🔗 LINK TO PRODUCT + TEMPLATE (SUNGURA CORE)
    product_id = Column(UUID(as_uuid=True), nullable=False)  # ✅ KEEP (single product support)
    template_id = Column(String, nullable=False)

    # ✅ NEW: MULTI-PRODUCT SUPPORT (MVP SAFE)
    product_ids = Column(JSON, nullable=True)

    # OPTIONAL HUMAN LABEL
    name = Column(String, nullable=True)

    # MULTI-PLATFORM SUPPORT (FUTURE SAFE)
    platforms = Column(JSON, nullable=False, default=["facebook"])

    # MULTI-PAGE SUPPORT
    page_ids = Column(JSON, nullable=False)

    # CONTENT
    caption = Column(Text, nullable=False)

    # ✅ SINGLE MEDIA (existing)
    media_url = Column(Text, nullable=True)

    # ✅ NEW: MULTI-MEDIA (scrollable posts)
    media_urls = Column(JSON, nullable=True)

    # SCHEDULING (UTC AWARE)
    scheduled_at = Column(DateTime(timezone=True), nullable=True)

    # EXECUTION STATE
    status = Column(String, default="draft")
    # draft | scheduled | processing | posted | failed

    # TIMESTAMPS
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )

    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )