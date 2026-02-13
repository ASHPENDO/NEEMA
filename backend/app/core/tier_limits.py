# ============================
# FILE: app/core/tier_limits.py
# (ADD helper for tier upgrade path)
# ============================
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class TierStaffLimit:
    max_staff: int


TIER_STAFF_LIMITS: dict[str, TierStaffLimit] = {
    "sungura": TierStaffLimit(max_staff=1),
    "swara": TierStaffLimit(max_staff=5),
    "ndovu": TierStaffLimit(max_staff=10),  # capped for now
}


def normalize_tier(value: str | None) -> str:
    return (value or "").strip().lower()


def tier_to_str(tier_obj) -> str | None:
    """
    Supports Enum-like tier objects (tier.value) or plain strings.
    """
    if tier_obj is None:
        return None
    v = getattr(tier_obj, "value", None)
    if isinstance(v, str) and v:
        return v
    s = str(tier_obj)
    return s if s else None


def get_staff_limit_for_tier(tier: str | None) -> int:
    t = normalize_tier(tier)
    if t in TIER_STAFF_LIMITS:
        return TIER_STAFF_LIMITS[t].max_staff
    return TIER_STAFF_LIMITS["sungura"].max_staff


def get_next_tier(tier: str | None) -> str | None:
    """
    Returns the next tier in the upgrade path, or None if already highest/unknown.
    """
    t = normalize_tier(tier)
    return {"sungura": "swara", "swara": "ndovu"}.get(t)
