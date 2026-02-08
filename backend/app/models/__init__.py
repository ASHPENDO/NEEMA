# Import models here so Alembic can discover metadata.
from app.models.user import User  # noqa: F401

# Phase 3 — tenants, memberships, invitations
from app.models.tenant import Tenant  # noqa: F401
from app.models.tenant_membership import TenantMembership  # noqa: F401
from app.models.tenant_invitation import TenantInvitation  # noqa: F401
