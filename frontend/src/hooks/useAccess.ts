// frontend/src/hooks/useAccess.ts
import { useCallback, useMemo } from "react";
import { hasPermission, type Permission, type Role } from "../auth/permissions";
import { useTenantMembership } from "./useTenantMembership";

type DenyReason = "no_tenant" | "loading" | "no_membership" | "missing_permission" | "unknown";

export function useAccess() {
  const { tenantId, membership, loading, error, refresh } = useTenantMembership();

  const role = (membership?.role as Role | undefined) ?? undefined;

  // "ready" means: we can make a stable access decision without flicker.
  // - If no tenant selected => ready (gating should hide tenant-scoped UI)
  // - If tenant selected => ready only once loading finishes
  const ready = !tenantId || !loading;

  const can = useCallback(
    (perm: Permission | string) => {
      if (!membership) return false;
      return hasPermission(membership, perm);
    },
    [membership]
  );

  const canAny = useCallback(
    (perms: Array<Permission | string>) => {
      if (!membership) return false;
      return perms.some((p) => hasPermission(membership, p));
    },
    [membership]
  );

  const canAll = useCallback(
    (perms: Array<Permission | string>) => {
      if (!membership) return false;
      return perms.every((p) => hasPermission(membership, p));
    },
    [membership]
  );

  function explainDeny(required?: Permission | string): { allowed: boolean; reason: DenyReason; message: string } {
    if (!tenantId) {
      return { allowed: false, reason: "no_tenant", message: "Select a tenant to continue." };
    }
    if (loading) {
      return { allowed: false, reason: "loading", message: "Checking permissions…" };
    }
    if (!membership) {
      // Could be 401/403, tenant mismatch, or server error
      const msg = error ? `Membership unavailable: ${error}` : "Membership unavailable.";
      return { allowed: false, reason: "no_membership", message: msg };
    }
    if (!required) {
      return { allowed: true, reason: "unknown", message: "" };
    }
    if (hasPermission(membership, required)) {
      return { allowed: true, reason: "unknown", message: "" };
    }
    return { allowed: false, reason: "missing_permission", message: "You don’t have permission to access this feature." };
  }

  return {
    tenantId,
    membership,
    role,

    loading,
    ready,
    error,
    refresh,

    can,
    canAny,
    canAll,

    explainDeny,
  };
}