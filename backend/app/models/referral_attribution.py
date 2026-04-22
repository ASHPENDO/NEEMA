from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db.base import Base


class ReferralAttribution(Base):
    """
    Links a tenant to a salesperson via referral code.

    This is the canonical attribution record used for:
    - commission calculation
    - analytics
    - audit trail
    """

    __tablename__ = "referral_attributions"
    __table_args__ = (
        Index("ix_referral_attr_salesperson", "salesperson_profile_id"),
        Index("ix_referral_attr_tenant", "tenant_id"),
        Index("ix_referral_attr_code", "referral_code"),
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

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,  # one attribution per tenant
        index=True,
    )

    referral_code: Mapped[str] = mapped_column(
        String(6),
        nullable=False,
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )