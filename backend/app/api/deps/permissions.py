from __future__ import annotations

from typing import Callable, Sequence

from fastapi import Depends, HTTPException, status

from app.api.deps.tenant import get_current_membership
from app.auth.permissions import effective_permissions, is_permitted, ROLE_OWNER
from app.models.tenant_membership import TenantMembership


def require_permissions(
    required: str | Sequence[str],
    *,
    any_of: bool = False,
) -> Callable:
    """
    Enforce RBAC permissions using:
      - get_current_membership()
      - TenantMembership.role
      - TenantMembership.permissions (extra grants)
      - OWNER always has all permissions

    Args:
      required: permission string OR list of permissions
      any_of: True => any required perm passes; False => all required perms required
    """
    required_list = [required] if isinstance(required, str) else list(required)

    async def _checker(
        membership: TenantMembership = Depends(get_current_membership),
    ) -> TenantMembership:
        role = (membership.role or "").strip().upper()
        if not role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "rbac_role_missing", "message": "Membership role is missing."},
            )

        if role == ROLE_OWNER:
            return membership

        grants = effective_permissions(role=role, extra=membership.permissions)

        checks = [is_permitted(role=role, grants=grants, required=p) for p in required_list]
        allowed = any(checks) if any_of else all(checks)

        if not allowed:
            missing = [p for p, ok in zip(required_list, checks) if not ok]
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "rbac_forbidden",
                    "message": "You do not have permission to perform this action.",
                    "required": required_list,
                    "missing": missing,
                    "role": role,
                },
            )

        return membership

    return _checker