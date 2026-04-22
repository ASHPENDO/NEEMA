# app/core/sales_attribution.py
from __future__ import annotations

import re
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.salesperson_profile import SalespersonProfile

REFERRAL_RE = re.compile(r"^[A-Z0-9]{6}$")


def normalize_referral_code(code: str | None) -> str | None:
    if not code:
        return None
    c = code.strip().upper()
    return c if REFERRAL_RE.match(c) else None


# ✅ UPDATED: Tier-based commission (NOT percentage)
def compute_commission_kes(
    *,
    tier: str,
    gross_amount_kes: Decimal | None = None,  # kept for compatibility
) -> Decimal:
    tier = (tier or "").strip().lower()

    if tier == "sungura":
        return Decimal("500.00")
    elif tier == "swara":
        return Decimal("1000.00")
    elif tier == "ndovu":
        return Decimal("2000.00")

    return Decimal("0.00")


async def resolve_salesperson_by_referral_code(
    db: AsyncSession,
    referral_code: str,
) -> Optional[SalespersonProfile]:
    stmt = (
        select(SalespersonProfile)
        .where(SalespersonProfile.referral_code == referral_code)
        .where(SalespersonProfile.is_active.is_(True))
    )
    return (await db.execute(stmt)).scalar_one_or_none()


def utcnow() -> datetime:
    return datetime.now(timezone.utc)