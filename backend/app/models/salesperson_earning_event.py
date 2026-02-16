# app/models/salesperson_earning_event.py
from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Index, Numeric, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db.base import Base


class SalespersonEarningEvent(Base):
    """
    Canonical, immutable commission ledger.

    Stores:
      - gross_amount (e.g., plan price)
      - commission_amount (what salesperson earns)
      - currency
      - event_type (TENANT_SIGNUP, SUBSCRIPTION_PAID, REFUND, ADJUSTMENT, ...)
      - metadata (JSONB) for receipts, policies, etc.

    NOTE:
      - The Python attribute cannot be named "metadata" because SQLAlchemy Declarative uses it.
      - We map attribute `event_metadata` -> DB column name "metadata".
    """

    __tablename__ = "salesperson_earning_events"
    __table_args__ = (
        Index("ix_sales_earn_events_salesperson_occurred", "salesperson_profile_id", "occurred_at"),
        Index("ix_sales_earn_events_tenant", "tenant_id"),
        Index("ix_sales_earn_events_type", "event_type"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

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
        index=True,
    )

    # Examples: TENANT_SIGNUP, SUBSCRIPTION_PAID, REFUND, ADJUSTMENT
    event_type: Mapped[str] = mapped_column(String(40), nullable=False, index=True)

    currency: Mapped[str] = mapped_column(String(10), nullable=False, default="KES", server_default="KES")

    # Economic meaning:
    # - gross_amount: what the customer paid / plan value (positive)
    # - commission_amount: salesperson commission (can be negative for clawback/refund)
    gross_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("0.00"), server_default="0.00")
    commission_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)

    # payment method that generated this: MPESA | STRIPE | MANUAL
    source: Mapped[str] = mapped_column(String(20), nullable=False, default="MANUAL", server_default="MANUAL")

    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        index=True,
    )

    # free-form info (e.g., mpesa receipt, stripe charge id, policy snapshot)
    # NOTE: attribute name cannot be "metadata" in SQLAlchemy Declarative
    event_metadata: Mapped[dict[str, Any]] = mapped_column(
        "metadata",  # keep DB column name
        JSONB,
        nullable=False,
        default=dict,
        server_default="{}",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
