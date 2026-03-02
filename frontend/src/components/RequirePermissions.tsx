// frontend/src/components/RequirePermissions.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAccess } from "../hooks/useAccess";
import type { Permission } from "../auth/permissions";
import { api, ApiError } from "../lib/api";

type RequirePermissionsProps = {
  permission?: Permission | string;
  permissions?: Array<Permission | string>;
  requireAll?: boolean; // default: false (require any)
  redirectTo?: string;  // default: "/dashboard"
  children: React.ReactNode;
};

/**
 * Hard permission gate + redirect.
 *
 * - Waits for membership resolution (no flicker)
 * - If no tenant selected -> /tenant-selection
 * - If token expired/invalid (401 from /tenants/membership) -> /login
 * - If missing permission -> redirectTo (default /dashboard)
 */
export default function RequirePermissions({
  permission,
  permissions,
  requireAll = false,
  redirectTo = "/dashboard",
  children,
}: RequirePermissionsProps) {
  const location = useLocation();
  const { tenantId, membership, ready, can, canAny, canAll } = useAccess();

  const [authRedirect, setAuthRedirect] = useState<string | null>(null);

  const required = useMemo(() => {
    if (permissions && permissions.length > 0) return { type: "multi" as const, perms: permissions };
    if (permission) return { type: "single" as const, perm: permission };
    return { type: "none" as const };
  }, [permission, permissions]);

  // Still loading membership -> render nothing to prevent flicker
  if (!ready) return null;

  // No tenant selected
  if (!tenantId) {
    return <Navigate to="/tenant-selection" replace state={{ from: location.pathname }} />;
  }

  // If we already determined auth is invalid -> login
  if (authRedirect) {
    return <Navigate to={authRedirect} replace state={{ from: location.pathname }} />;
  }

  // Membership missing: disambiguate 401 vs other issues by pinging membership endpoint once.
  // This is only triggered for protected routes when membership is not available.
  // (Normally, membership should be present via useTenantMembership cache/fetch.)
  if (!membership) {
    // Kick off a one-time check
    // NOTE: we do not render children while checking; we will redirect or fall back.
    return <AuthProbe onResult={setAuthRedirect} fallbackTo={redirectTo} from={location.pathname} />;
  }

  // Permission checks
  let allowed = true;

  if (required.type === "single") {
    allowed = can(required.perm);
  } else if (required.type === "multi") {
    allowed = requireAll ? canAll(required.perms) : canAny(required.perms);
  }

  if (!allowed) {
    return <Navigate to={redirectTo} replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}

/**
 * Small helper component that probes /tenants/membership to determine if the user
 * is unauthenticated (401) and should be redirected to /login.
 */
function AuthProbe({
  onResult,
  fallbackTo,
  from,
}: {
  onResult: (to: string) => void;
  fallbackTo: string;
  from: string;
}) {
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // If token is expired/invalid, backend should respond 401.
        await api("/api/v1/tenants/membership", { method: "GET" });
        if (cancelled) return;

        // If membership exists but hook hasn't caught up yet, just send them to fallback route.
        onResult(fallbackTo);
      } catch (e) {
        if (cancelled) return;

        if (e instanceof ApiError && e.status === 401) {
          onResult("/login");
        } else {
          // Any other error: safest is fallback route (dashboard)
          onResult(fallbackTo);
        }
      } finally {
        if (!cancelled) setDone(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [onResult, fallbackTo]);

  // Render nothing (hard block, no flicker)
  if (!done) return null;
  return null;
}