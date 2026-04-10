from __future__ import annotations

import uuid
from sqlalchemy import Column, DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.db.base import Base


class CatalogItem(Base):
    __tablename__ = "catalog_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    tenant_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    created_by_user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # 🔹 Core Product Fields
    title = Column(String(255), nullable=False)
    sku = Column(String(128), nullable=True)
    description = Column(Text, nullable=True)
    image_url = Column(String(2048), nullable=True)

    # 🔹 Pricing (Multi-Currency Ready)
    price_amount = Column(Numeric(12, 2), nullable=False)

    # IMPORTANT:
    # - Stores ORIGINAL currency entered by user
    # - Supported: KES, UGX, TZS (validated at schema level)
    # - Default = KES for backward compatibility
    price_currency = Column(
        String(8),
        nullable=False,
        default="KES",
        index=True,  # 🔥 future analytics + filtering
    )

    # 🔹 Status Management
    status = Column(
        String(32),
        nullable=False,
        default="active",  # active | archived (future)
    )

    # 🔹 Timestamps
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    # 🔹 Debugging / Logging (VERY useful during ingestion issues)
    def __repr__(self) -> str:
        return (
            f"<CatalogItem(id={self.id}, title={self.title}, "
            f"price={self.price_amount} {self.price_currency}, "
            f"tenant_id={self.tenant_id})>"
        )