// frontend/src/components/RequirePermissions.tsx
import React, { useMemo } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAccess } from "../hooks/useAccess";
import type { Permission } from "../auth/permissions";
import { hasPermission } from "../auth/permissions";

type RequirePermissionsProps = {
  permission?: Permission | string;
  permissions?: Array<Permission | string>;
  requireAll?: boolean; // default false => require any
  redirectTo?: string; // default /dashboard
  children: React.ReactNode;
};

export default function RequirePermissions({
  permission,
  permissions,
  requireAll = false,
  redirectTo = "/dashboard",
  children,
}: RequirePermissionsProps) {
  const location = useLocation();
  const { tenantId, membership, ready } = useAccess();

  const required = useMemo(() => {
    if (permissions && permissions.length > 0) {
      return { type: "multi" as const, perms: permissions };
    }
    if (permission) {
      return { type: "single" as const, perm: permission };
    }
    return { type: "none" as const };
  }, [permission, permissions]);

  // Prevent flicker while tenant membership is still resolving
  if (!ready) return null;

  // Tenant-scoped routes must have an active tenant
  if (!tenantId) {
    return <Navigate to="/tenant-selection" replace state={{ from: location.pathname }} />;
  }

  // No membership after ready => safest fallback is dashboard
  // (auth expiry / invalid token should already be handled by auth/bootstrap logic)
  if (!membership) {
    return <Navigate to={redirectTo} replace state={{ from: location.pathname }} />;
  }

  // No permission requirement
  if (required.type === "none") {
    return <>{children}</>;
  }

  const allowed =
    required.type === "single"
      ? hasPermission(membership, required.perm)
      : requireAll
        ? required.perms.every((p) => hasPermission(membership, p))
        : required.perms.some((p) => hasPermission(membership, p));

  if (!allowed) {
    return <Navigate to={redirectTo} replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}