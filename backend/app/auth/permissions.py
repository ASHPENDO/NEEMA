from __future__ import annotations

from dataclasses import dataclass
from typing import FrozenSet, Iterable, Mapping

ROLE_OWNER = "OWNER"
ROLE_ADMIN = "ADMIN"
ROLE_MANAGER = "MANAGER"
ROLE_STAFF = "STAFF"


@dataclass(frozen=True)
class Permission:
    # tenant.*
    TENANT_READ: str = "tenant.read"
    TENANT_WRITE: str = "tenant.write"
    TENANT_MEMBERS_READ: str = "tenant.members.read"
    TENANT_MEMBERS_WRITE: str = "tenant.members.write"
    TENANT_INVITES_MANAGE: str = "tenant.invites.manage"

    # catalog.*
    CATALOG_READ: str = "catalog.read"
    CATALOG_WRITE: str = "catalog.write"
    CATALOG_IMPORT: str = "catalog.import"

    # publish.*
    PUBLISH_READ: str = "publish.read"
    PUBLISH_WRITE: str = "publish.write"
    PUBLISH_SCHEDULE: str = "publish.schedule"

    # ads.*
    ADS_READ: str = "ads.read"
    ADS_WRITE: str = "ads.write"
    ADS_BUDGETS: str = "ads.budgets"
    ADS_PIXELS: str = "ads.pixels"

    # inbox.*
    INBOX_READ: str = "inbox.read"
    INBOX_WRITE: str = "inbox.write"
    INBOX_ASSIGN: str = "inbox.assign"

    # analytics.*
    ANALYTICS_READ: str = "analytics.read"
    ANALYTICS_EXPORT: str = "analytics.export"

    # attribution.*
    ATTRIBUTION_READ: str = "attribution.read"
    ATTRIBUTION_WRITE: str = "attribution.write"

    # billing.*
    BILLING_READ: str = "billing.read"
    BILLING_WRITE: str = "billing.write"

    # ai.*
    AI_READ: str = "ai.read"
    AI_WRITE: str = "ai.write"

    # wildcards (domain-level)
    TENANT_ALL: str = "tenant.*"
    CATALOG_ALL: str = "catalog.*"
    PUBLISH_ALL: str = "publish.*"
    ADS_ALL: str = "ads.*"
    INBOX_ALL: str = "inbox.*"
    ANALYTICS_ALL: str = "analytics.*"
    ATTRIBUTION_ALL: str = "attribution.*"
    BILLING_ALL: str = "billing.*"
    AI_ALL: str = "ai.*"


PERM = Permission()

ROLE_BASE_PERMISSIONS: Mapping[str, FrozenSet[str]] = {
    ROLE_ADMIN: frozenset(
        {
            PERM.TENANT_ALL,
            PERM.CATALOG_ALL,
            PERM.PUBLISH_ALL,
            PERM.ADS_ALL,
            PERM.INBOX_ALL,
            PERM.ANALYTICS_ALL,
            PERM.ATTRIBUTION_ALL,
            PERM.BILLING_ALL,
            PERM.AI_ALL,
        }
    ),
    ROLE_MANAGER: frozenset(
        {
            PERM.TENANT_READ,
            PERM.TENANT_MEMBERS_READ,
            PERM.TENANT_INVITES_MANAGE,
            PERM.CATALOG_ALL,
            PERM.PUBLISH_ALL,
            PERM.ADS_ALL,
            PERM.INBOX_ALL,
            PERM.ANALYTICS_ALL,
            PERM.ATTRIBUTION_ALL,
            PERM.AI_ALL,
            # billing stays read-only unless added via membership.permissions
            PERM.BILLING_READ,
        }
    ),
    ROLE_STAFF: frozenset(
        {
            PERM.TENANT_READ,
            PERM.CATALOG_READ,
            PERM.PUBLISH_READ,
            PERM.INBOX_ALL,
            PERM.ANALYTICS_READ,
            PERM.AI_READ,
        }
    ),
}


def _normalize_role(role: str | None) -> str:
    return (role or "").strip().upper()


def _normalize_extras(extra: Iterable[str] | None) -> FrozenSet[str]:
    if not extra:
        return frozenset()
    return frozenset(p.strip() for p in extra if isinstance(p, str) and p.strip())


def effective_permissions(*, role: str | None, extra: Iterable[str] | None) -> FrozenSet[str]:
    """
    Base role grants + membership.permissions extras (additive).
    OWNER is handled as "all" in is_permitted() and require_permissions().
    """
    r = _normalize_role(role)
    base = ROLE_BASE_PERMISSIONS.get(r, frozenset())
    extras = _normalize_extras(extra)
    if not extras:
        return base
    return frozenset(set(base) | set(extras))


def _has_domain_wildcard(grants: FrozenSet[str], required: str) -> bool:
    if required in grants:
        return True
    idx = required.find(".")
    if idx <= 0:
        return False
    domain = required[:idx]
    return f"{domain}.*" in grants


def is_permitted(*, role: str | None, grants: FrozenSet[str], required: str) -> bool:
    """
    OWNER always allowed (future-proof).
    """
    if _normalize_role(role) == ROLE_OWNER:
        return True
    return _has_domain_wildcard(grants, required)