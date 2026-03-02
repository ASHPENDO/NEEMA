# app/auth/permissions.py
from __future__ import annotations

from enum import StrEnum
from typing import Dict, FrozenSet, Iterable, Set


class Permission(StrEnum):
    # -------------------------
    # Catalog & products
    # -------------------------
    CATALOG_READ = "catalog:read"
    CATALOG_CREATE = "catalog:create"
    CATALOG_UPDATE = "catalog:update"
    CATALOG_DELETE = "catalog:delete"

    PRODUCT_READ = "product:read"
    PRODUCT_CREATE = "product:create"
    PRODUCT_UPDATE = "product:update"
    PRODUCT_DELETE = "product:delete"

    PRODUCT_BULK_UPLOAD = "product:bulk_upload"  # zip/import
    PRODUCT_SCRAPE = "product:scrape"  # website scrape/import

    # -------------------------
    # Publishing & automation
    # -------------------------
    PUBLISH_POST = "publish:post"
    PUBLISH_SCHEDULE = "publish:schedule"
    PUBLISH_AUTOMATE = "publish:automate"
    PUBLISH_MANAGE_QUEUE = "publish:manage_queue"  # cancel/retry jobs

    # -------------------------
    # AI content studio
    # -------------------------
    AI_ENHANCE = "ai:enhance"
    AI_GENERATE = "ai:generate"
    AI_APPROVE = "ai:approve"  # optional gate

    # -------------------------
    # Inbox & comms
    # -------------------------
    INBOX_READ = "inbox:read"
    INBOX_REPLY = "inbox:reply"
    INBOX_ASSIGN = "inbox:assign"
    INBOX_TEMPLATES = "inbox:templates"

    # -------------------------
    # Analytics & reporting
    # -------------------------
    ANALYTICS_READ = "analytics:read"
    ANALYTICS_EXPORT = "analytics:export"

    REPORTS_READ = "reports:read"
    REPORTS_CONFIGURE = "reports:configure"

    # -------------------------
    # Campaigns / retargeting / PDA
    # -------------------------
    CAMPAIGN_READ = "campaign:read"
    CAMPAIGN_CREATE = "campaign:create"
    CAMPAIGN_UPDATE = "campaign:update"
    CAMPAIGN_PAUSE_RESUME = "campaign:pause_resume"
    CAMPAIGN_DELETE = "campaign:delete"

    PDA_READ = "pda:read"
    PDA_CONFIGURE = "pda:configure"

    # -------------------------
    # Notifications
    # -------------------------
    NOTIFICATIONS_READ = "notifications:read"
    NOTIFICATIONS_MANAGE = "notifications:manage"

    # -------------------------
    # Tenant admin (non-security)
    # -------------------------
    MEMBERS_READ = "members:read"
    MEMBERS_INVITE = "members:invite"
    MEMBERS_UPDATE_ROLE = "members:update_role"
    MEMBERS_DEACTIVATE = "members:deactivate"

    # -------------------------
    # Security (explicitly separated)
    # -------------------------
    SECURITY_READ = "security:read"
    SECURITY_MANAGE = "security:manage"
    AUDIT_LOGS_READ = "audit_logs:read"

    # -------------------------
    # Billing (explicitly separated)
    # -------------------------
    BILLING_READ = "billing:read"
    BILLING_MANAGE = "billing:manage"


# Canonical all-permissions set
ALL_PERMISSIONS: FrozenSet[str] = frozenset(p.value for p in Permission)

# -------------------------
# Permission bundles
# -------------------------

# STAFF: everything marketing execution, but NO deletes (safety),
# and NO billing/security/member-management.
STAFF_MARKETING_EXECUTION: FrozenSet[str] = frozenset(
    {
        # Catalog
        Permission.CATALOG_READ.value,
        Permission.CATALOG_CREATE.value,
        Permission.CATALOG_UPDATE.value,
        # NO: Permission.CATALOG_DELETE

        # Products
        Permission.PRODUCT_READ.value,
        Permission.PRODUCT_CREATE.value,
        Permission.PRODUCT_UPDATE.value,
        # NO: Permission.PRODUCT_DELETE

        Permission.PRODUCT_BULK_UPLOAD.value,
        Permission.PRODUCT_SCRAPE.value,

        # Publishing/automation
        Permission.PUBLISH_POST.value,
        Permission.PUBLISH_SCHEDULE.value,
        Permission.PUBLISH_AUTOMATE.value,
        Permission.PUBLISH_MANAGE_QUEUE.value,

        # AI studio
        Permission.AI_ENHANCE.value,
        Permission.AI_GENERATE.value,
        # Optional approval gate:
        # Permission.AI_APPROVE.value,

        # Inbox
        Permission.INBOX_READ.value,
        Permission.INBOX_REPLY.value,

        # Analytics/reports (read)
        Permission.ANALYTICS_READ.value,
        Permission.REPORTS_READ.value,

        # Campaigns/PDA (no delete)
        Permission.CAMPAIGN_READ.value,
        Permission.CAMPAIGN_CREATE.value,
        Permission.CAMPAIGN_UPDATE.value,
        Permission.CAMPAIGN_PAUSE_RESUME.value,
        # NO: Permission.CAMPAIGN_DELETE

        Permission.PDA_READ.value,
        Permission.PDA_CONFIGURE.value,

        # Notifications (read)
        Permission.NOTIFICATIONS_READ.value,
    }
)

# MANAGER: lead for ops; can export analytics, configure reports, manage inbox routing/templates.
# Still NO deletes by default (keeps "delete" as an ADMIN/OWNER responsibility).
MANAGER_EXTRA: FrozenSet[str] = frozenset(
    {
        Permission.ANALYTICS_EXPORT.value,
        Permission.REPORTS_CONFIGURE.value,
        Permission.INBOX_ASSIGN.value,
        Permission.INBOX_TEMPLATES.value,
        # Optional: approval gate (enable if you want review-before-publish)
        # Permission.AI_APPROVE.value,
    }
)

# ADMIN: operational admin (team + governance).
# Explicitly blocked from billing/security by enforcement; can delete marketing objects.
ADMIN_EXTRA: FrozenSet[str] = frozenset(
    {
        Permission.MEMBERS_READ.value,
        Permission.MEMBERS_INVITE.value,
        Permission.MEMBERS_UPDATE_ROLE.value,
        Permission.MEMBERS_DEACTIVATE.value,
        Permission.AUDIT_LOGS_READ.value,
    }
)

# Deletes are ADMIN-only (and OWNER implicitly).
ADMIN_DELETE_EXTRA: FrozenSet[str] = frozenset(
    {
        Permission.CATALOG_DELETE.value,
        Permission.PRODUCT_DELETE.value,
        Permission.CAMPAIGN_DELETE.value,
    }
)


def normalize_permissions(perms: Iterable[str] | None) -> Set[str]:
    """Normalize arbitrary permission strings into a validated set.

    - Drops unknown permissions (safety)
    - Strips whitespace
    """
    out: Set[str] = set()
    if not perms:
        return out
    for p in perms:
        if not p:
            continue
        s = str(p).strip()
        if s in ALL_PERMISSIONS:
            out.add(s)
    return out


# -------------------------------------------------------------------
# Role defaults (string-based to avoid circular imports)
# -------------------------------------------------------------------
ROLE_DEFAULT_PERMISSIONS: Dict[str, FrozenSet[str]] = {
    "OWNER": ALL_PERMISSIONS,
    "ADMIN": frozenset(
        set(STAFF_MARKETING_EXECUTION)
        | set(MANAGER_EXTRA)
        | set(ADMIN_EXTRA)
        | set(ADMIN_DELETE_EXTRA)
    ),
    "MANAGER": frozenset(set(STAFF_MARKETING_EXECUTION) | set(MANAGER_EXTRA)),
    "STAFF": STAFF_MARKETING_EXECUTION,
}

# Permissions that are explicitly sensitive and should NOT be granted to ADMIN/STAFF/MANAGER
# (enforced in get_effective_permissions() by subtracting these unless OWNER).
SENSITIVE_PERMISSIONS: FrozenSet[str] = frozenset(
    {
        Permission.BILLING_READ.value,
        Permission.BILLING_MANAGE.value,
        Permission.SECURITY_READ.value,
        Permission.SECURITY_MANAGE.value,
    }
)

# -------------------------------------------------------------------
# Backwards-compatible PERM shim (legacy PERM.TENANT_* constants)
# -------------------------------------------------------------------
# Older modules still reference:
#   PERM.TENANT_WRITE
#   PERM.TENANT_MEMBERS_READ
#   PERM.TENANT_MEMBERS_WRITE
#   PERM.TENANT_INVITES_MANAGE
#
# We map these to the new permission taxonomy.

class _LegacyPERM:
    TENANT_WRITE = Permission.MEMBERS_INVITE.value

    TENANT_MEMBERS_READ = Permission.MEMBERS_READ.value
    TENANT_MEMBERS_WRITE = Permission.MEMBERS_UPDATE_ROLE.value

    TENANT_INVITES_MANAGE = Permission.MEMBERS_INVITE.value


PERM = _LegacyPERM()