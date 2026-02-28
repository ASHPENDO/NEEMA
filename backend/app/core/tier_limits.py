# ============================
# FILE: app/core/tier_limits.py
# Canonical tier limits for POSTIKA
# ============================
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class TierStaffLimit:
    max_staff: int


# ✅ NEW seat model (by role):
# - sungura: 1 staff
# - swara: 4 staff
# - ndovu: 9 staff
TIER_STAFF_LIMITS: dict[str, TierStaffLimit] = {
    "sungura": TierStaffLimit(max_staff=1),
    "swara": TierStaffLimit(max_staff=4),
    "ndovu": TierStaffLimit(max_staff=9),
}


def normalize_tier(value: str | None) -> str:
    return (value or "").strip().lower()


def tier_to_str(tier_obj) -> str | None:
    """
    Supports Enum-like tier objects (tier.value) or plain strings.
    Returns None if empty.
    """
    if tier_obj is None:
        return None
    v = getattr(tier_obj, "value", None)
    if isinstance(v, str) and v:
        return v
    s = str(tier_obj)
    return s if s else None


def get_staff_limit_for_tier(tier: str | None) -> int:
    """
    Returns the max number of STAFF memberships allowed for the given tier.
    Defaults to sungura if unknown.
    """
    t = normalize_tier(tier)
    if t in TIER_STAFF_LIMITS:
        return TIER_STAFF_LIMITS[t].max_staff
    return TIER_STAFF_LIMITS["sungura"].max_staff


def get_admin_limit_for_tier(tier: str | None) -> int:
    """
    Returns the max number of ADMIN memberships allowed for the given tier.
    Your policy: 1 ADMIN for all tiers.
    """
    _ = normalize_tier(tier)
    return 1


def get_next_tier(tier: str | None) -> str | None:
    """
    Returns the next tier in the upgrade path, or None if already highest/unknown.
    """
    t = normalize_tier(tier)
    return {"sungura": "swara", "swara": "ndovu"}.get(t)