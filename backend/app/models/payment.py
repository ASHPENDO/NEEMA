from sqlalchemy import (
    Column,
    String,
    Integer,
    DateTime,
    JSON,
    ForeignKey,
    UniqueConstraint,
)
from sqlalchemy.sql import func
import uuid

from app.db.base_class import Base


class Payment(Base):
    __tablename__ = "payments"

    __table_args__ = (
        # 🔒 HARD idempotency guarantee at DB level
        UniqueConstraint(
            "checkout_request_id",
            name="uq_payments_checkout_request_id",
        ),
    )

    # =========================
    # 🔑 PRIMARY KEY
    # =========================
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))

    # =========================
    # 🔗 RELATIONSHIP
    # =========================
    tenant_id = Column(
        String,
        ForeignKey("tenants.id"),
        nullable=False,
        index=True,
    )

    # =========================
    # 🧾 MPESA IDENTIFIERS
    # =========================
    checkout_request_id = Column(
        String,
        nullable=False,
        index=True,
    )

    merchant_request_id = Column(String, nullable=True)

    mpesa_receipt_number = Column(
        String,
        nullable=True,
        index=True,  # 🔍 useful for support/debug
    )

    # =========================
    # 💰 PAYMENT DETAILS
    # =========================
    phone = Column(String, nullable=True)

    amount = Column(Integer, nullable=False)

    currency = Column(String, nullable=False, default="KES")

    # =========================
    # 🔄 STATUS LIFECYCLE
    # =========================
    status = Column(
        String,
        nullable=False,
        default="pending",  # pending | success | failed
        index=True,         # 🔍 fast filtering
    )

    result_code = Column(Integer, nullable=True)

    result_desc = Column(String, nullable=True)

    # =========================
    # 🧠 AUDIT / DEBUG
    # =========================
    raw_callback = Column(JSON, nullable=True)

    # =========================
    # 🕒 TIMESTAMPS
    # =========================
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    updated_at = Column(
        DateTime(timezone=True),
        onupdate=func.now(),
        nullable=True,
    )