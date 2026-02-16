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


def compute_commission_kes(
    *,
    tier: str,
    gross_amount_kes: Decimal,
) -> Decimal:
    """
    Central policy. Adjust later without rewriting endpoints.
    Current policy: flat 20% commission on the first payment amount.
    """
    _ = tier  # reserved for tier-based policies later
    rate = Decimal("0.20")
    return (gross_amount_kes * rate).quantize(Decimal("1.00"))


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
