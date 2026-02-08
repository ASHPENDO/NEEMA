# app/core/tier.py (or app/models/enums.py)

import enum

class TenantTier(str, enum.Enum):
    SUNGURA = "SUNGURA"
    SWARA = "SWARA"
    NDOVU = "NDOVU"
