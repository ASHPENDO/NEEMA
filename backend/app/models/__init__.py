# Import models here so Alembic can discover metadata.
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