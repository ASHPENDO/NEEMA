# backend/app/models/user.py
import re
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, DateTime, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db.base import Base

_E164_RE = re.compile(r"^\+[1-9]\d{1,14}$")


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)

    # Email-first magic code auth
    magic_code: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    magic_code_expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Profile completion (post-login)
    full_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)

    # Legacy field (keep to avoid breaking existing DB/data; stop using in APIs)
    phone_number: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)

    # Canonical for Milestone 1
    phone_e164: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    country: Mapped[Optional[str]] = mapped_column(String(2), nullable=True)  # ISO-3166-1 alpha-2 (e.g., KE)

    # Keep for backwards compatibility if already deployed; not used by magic-code auth
    password_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    @hybrid_property
    def is_profile_complete(self) -> bool:
        # Derived rule (canonical):
        # profile_complete = full_name is not null AND phone_e164 is not null
        return self.full_name is not None and self.phone_e164 is not None

    @staticmethod
    def normalize_full_name(value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        v = " ".join(value.strip().split())
        return v or None

    @staticmethod
    def normalize_phone_e164(value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        v = value.strip()
        if not v:
            return None
        # keep '+' and digits only
        v = re.sub(r"[^\d+]", "", v)
        if not _E164_RE.match(v):
            raise ValueError("phone_e164 must be a valid E.164 number (e.g., +254712345678).")
        return v

    @staticmethod
    def normalize_country(value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        v = value.strip()
        if not v:
            return None
        v = v.upper()
        if not re.fullmatch(r"[A-Z]{2}", v):
            raise ValueError("country must be a 2-letter ISO code (e.g., KE).")
        return v
