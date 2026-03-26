# Import models here so Alembic can discover metadata.

# Core
from app.models.user import User  # noqa: F401

# Phase 3 — tenants, memberships, invitations
from app.models.tenant import Tenant  # noqa: F401
from app.models.tenant_membership import TenantMembership  # noqa: F401
from app.models.tenant_invitation import TenantInvitation  # noqa: F401
from app.models.platform_invitation import PlatformInvitation  # noqa: F401
from app.models.platform_membership import PlatformMembership  # noqa: F401
from app.models.salesperson_profile import SalespersonProfile  # noqa: F401

# Phase 4 — catalog
from app.models.catalog_item import CatalogItem  # noqa: F401

# Phase 5 — social oauth
from app.models.social_connection import SocialConnection  # noqa: F401
from app.models.social_platform_account import SocialPlatformAccount  # noqa: F401

# ✅ Facebook OAuth + persistence
from app.models.social_account import SocialAccount  # noqa: F401
from app.models.facebook_catalog import FacebookCatalog  # noqa: F401

# ✅ NEW — Meta Catalogs (CRITICAL)
from app.models.meta_catalog import MetaCatalog  # noqa: F401

# Phase 6 — posting & campaigns

from app.models.post_history import PostHistory  # noqa: F401
from app.models.campaign import Campaign  # noqa: F401