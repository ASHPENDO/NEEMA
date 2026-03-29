# app/models/__init__.py

# Import models here so Alembic can discover metadata.

# =========================
# CORE
# =========================
from app.models.user import User  # noqa: F401


# =========================
# TENANTS (PHASE 3)
# =========================
from app.models.tenant import Tenant  # noqa: F401
from app.models.tenant_membership import TenantMembership  # noqa: F401
from app.models.tenant_invitation import TenantInvitation  # noqa: F401
from app.models.platform_invitation import PlatformInvitation  # noqa: F401
from app.models.platform_membership import PlatformMembership  # noqa: F401
from app.models.salesperson_profile import SalespersonProfile  # noqa: F401


# =========================
# CATALOG (PHASE 4)
# =========================
from app.models.catalog_item import CatalogItem  # noqa: F401


# =========================
# SOCIAL OAUTH (PHASE 5)
# =========================
from app.models.social_connection import SocialConnection  # noqa: F401
from app.models.social_platform_account import SocialPlatformAccount  # noqa: F401

# ✅ ACTIVE FACEBOOK SYSTEM
from app.models.social_account import SocialAccount  # noqa: F401
from app.models.facebook_catalog import FacebookCatalog  # noqa: F401
from app.models.meta_catalog import MetaCatalog  # noqa: F401


# =========================
# CAMPAIGNS & POSTING (PHASE 6)
# =========================
from app.models.post_history import PostHistory  # noqa: F401
from app.models.campaign import Campaign  # noqa: F401