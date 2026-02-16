from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Numeric, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db.base import Base


class SalespersonEarningEvent(Base):
    __tablename__ = "salesperson_earning_events"
    __table_args__ = (
        Index(
            "ix_sales_earn_events_salesperson_occurred",
            "salesperson_profile_id",
            "occurred_at",
        ),
        Index("ix_sales_earn_events_tenant", "tenant_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    salesperson_profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("salesperson_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    tenant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Examples: TENANT_CREATED, SUBSCRIPTION_PAID, REFUND, ADJUSTMENT
    event_type: Mapped[str] = mapped_column(String(40), nullable=False)

    # Money earned (+) or deducted (-)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(10), nullable=False, default="KES")

    # payment method that generated this: MPESA | STRIPE | MANUAL
    source: Mapped[str] = mapped_column(String(20), nullable=False, default="MANUAL")

    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    # free-form info (e.g., mpesa receipt, stripe charge id)
    # NOTE: attribute name cannot be "metadata" in SQLAlchemy Declarative
    event_metadata: Mapped[dict] = mapped_column(
        "metadata",  # keep DB column name the same
        JSONB,
        nullable=False,
        default=dict,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
