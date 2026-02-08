# app/core/limits.py

from app.core.tier import TenantTier

STAFF_CAP_BY_TIER = {
    TenantTier.SUNGURA: 1,
    TenantTier.SWARA: 5,
    TenantTier.NDOVU: 10,
}
