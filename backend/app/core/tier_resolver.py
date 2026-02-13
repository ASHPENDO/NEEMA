from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from app.core.tier_limits import tier_to_str


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def resolve_effective_tier(tenant) -> str:
    """
    Resolve tier for enforcement based on billing/subscription fields if present,
    otherwise fall back to tenant.tier.

    This is intentionally defensive: it won't break if billing fields don't exist yet.
    """
    # 1) If you later add fields like:
    # tenant.subscription_status: "active" | "trialing" | "past_due" | "canceled"
    # tenant.subscription_tier: "sungura" | "swara" | "ndovu"
    # tenant.trial_ends_at: datetime | None
    # then use them here.

    subscription_status = getattr(tenant, "subscription_status", None)
    subscription_tier = getattr(tenant, "subscription_tier", None)
    trial_ends_at: Optional[datetime] = getattr(tenant, "trial_ends_at", None)

    now = _utcnow()

    # Active subscription tier wins
    if subscription_status == "active" and subscription_tier:
        return tier_to_str(subscription_tier)

    # Trial: allow subscription_tier if trialing and not expired; else fall back
    if subscription_status == "trialing" and subscription_tier:
        if trial_ends_at is None or trial_ends_at > now:
            return tier_to_str(subscription_tier)

    # Optional policy: if past_due/canceled, downgrade enforcement to sungura
    # (Choose what you want; safe default is to keep tenant.tier)
    # if subscription_status in {"past_due", "canceled"}:
    #     return "sungura"

    return tier_to_str(getattr(tenant, "tier", None))
