# app/core/roles.py

import enum

class TenantMembershipRole(str, enum.Enum):
    OWNER = "OWNER"   # creator / ultimate authority
    ADMIN = "ADMIN"   # can do everything in tenant (like owner)
    STAFF = "STAFF"   # permission checkbox-driven
