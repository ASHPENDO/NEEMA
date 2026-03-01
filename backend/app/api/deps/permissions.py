# app/api/deps/permissions.py
from __future__ import annotations

from typing import Callable, Iterable, Optional, Set

from fastapi import Depends, HTTPException, status

from app.auth.permissions import (
    ALL_PERMISSIONS,
    ROLE_DEFAULT_PERMISSIONS,
    SENSITIVE_PERMISSIONS,
    normalize_permissions,
)

# IMPORTANT:
# Adjust this import path to your actual "current membership" dependency.
# The function must return the membership for the current request & tenant,
# including .role (OWNER/ADMIN/MANAGER/STAFF) and .permissions (list[str] or None).
from app.api.deps.tenant import get_current_membership  # noqa: F401


def _role_string(role: object) -> str:
    """Convert enum/str role into a stable uppercase string."""
    if role is None:
        return ""
    s = str(role)
    # Handles Enum repr like "TenantRole.ADMIN" or "ADMIN"
    if "." in s:
        s = s.split(".")[-1]
    return s.strip().upper()


def get_effective_permissions(membership: object) -> Set[str]:
    """Compute effective permission set for a membership.

    Rules:
    - OWNER => allow-all
    - Otherwise:
      effective = role_defaults(role) U membership.permissions (validated)
      BUT: sensitive permissions are ignored unless role is OWNER.
    """
    role = _role_string(getattr(membership, "role", None))

    if role == "OWNER":
        return set(ALL_PERMISSIONS)

    role_defaults = set(ROLE_DEFAULT_PERMISSIONS.get(role, frozenset()))
    explicit = normalize_permissions(getattr(membership, "permissions", None))

    effective = role_defaults | explicit

    # Enforce explicit separation: no billing/security unless OWNER.
    effective -= set(SENSITIVE_PERMISSIONS)

    return effective


def forbid(detail: dict) -> None:
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


def require_permissions(*required: str) -> Callable:
    """Require ALL listed permissions.

    Usage:
      @router.post("/x", dependencies=[Depends(require_permissions("product:bulk_upload"))])
      async def ...:
          ...

    or:
      async def endpoint(m=Depends(get_current_membership), _=Depends(require_permissions(...))):
          ...
    """
    required_set = normalize_permissions(required)

    async def _dep(membership=Depends(get_current_membership)) -> None:
        effective = get_effective_permissions(membership)

        missing = sorted(p for p in required_set if p not in effective)
        if missing:
            forbid(
                {
                    "code": "missing_permissions",
                    "missing_permissions": missing,
                }
            )

    return _dep


def require_any_permission(*required_any: str) -> Callable:
    """Require at least ONE of the listed permissions."""
    required_set = normalize_permissions(required_any)

    async def _dep(membership=Depends(get_current_membership)) -> None:
        effective = get_effective_permissions(membership)
        if not any(p in effective for p in required_set):
            forbid(
                {
                    "code": "missing_permissions_any",
                    "required_any": sorted(required_set),
                }
            )

    return _dep


def forbid_sensitive_for_non_owner(membership: object, requested: Iterable[str]) -> None:
    """Optional helper if you want to guard some endpoints with an extra check."""
    role = _role_string(getattr(membership, "role", None))
    if role == "OWNER":
        return
    req = set(normalize_permissions(requested))
    sensitive_requested = sorted(req & set(SENSITIVE_PERMISSIONS))
    if sensitive_requested:
        forbid(
            {
                "code": "sensitive_permission_blocked",
                "blocked_permissions": sensitive_requested,
            }
        )