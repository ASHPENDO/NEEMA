// frontend/src/components/TenantRoleGuard.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { api, ApiError, type TenantRole } from "../lib/api";
import { activeTenantStorage } from "../lib/tenantStorage";

type MyMembership = {
  tenant_id: string;
  user_id: string;
  role: TenantRole;
  permissions: string[];
  is_active: boolean;
  accepted_terms: boolean;
  notifications_opt_in: boolean;
  referral_code: string | null;
  created_at: string;
};

type Props = {
  allow: TenantRole[];
  children: React.ReactNode;
};

/**
 * Route-level RBAC guard for tenant-scoped pages.
 *
 * Rules:
 * - If no active tenant -> /tenant-selection
 * - Fetch /api/v1/tenants/membership (authoritative)
 * - If role not allowed -> /dashboard
 * - If 401 -> /login
 */
export default function TenantRoleGuard({ allow, children }: Props) {
  const nav = useNavigate();
  const loc = useLocation();

  const tenantId = useMemo(() => activeTenantStorage.get(), []);
  const [checking, setChecking] = useState(true);
  const [redirect, setRedirect] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId) {
      setRedirect("/tenant-selection");
      setChecking(false);
      return;
    }

    let cancelled = false;

    async function check() {
      setChecking(true);
      setRedirect(null);

      try {
        const mem = await api<MyMembership>("/api/v1/tenants/membership", { method: "GET" });
        if (cancelled) return;

        const role = mem?.role;
        if (!role || !allow.includes(role)) {
          setRedirect("/dashboard");
          return;
        }

        // allowed -> render children
        setRedirect(null);
      } catch (e) {
        if (cancelled) return;

        const err = e as ApiError;

        if (err?.status === 401) {
          // Not authenticated
          setRedirect("/login");
        } else if (err?.status === 403) {
          // Authenticated but forbidden (or tenant header mismatch)
          setRedirect("/dashboard");
        } else {
          // For any other unexpected errors, safest fallback is dashboard
          setRedirect("/dashboard");
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    }

    void check();
    return () => {
      cancelled = true;
    };
  }, [tenantId, allow]);

  if (checking) {
    return (
      <div className="min-h-screen bg-slate-950">
        <div className="max-w-5xl mx-auto px-4 py-10 text-white/70">
          Checking permissions…
        </div>
      </div>
    );
  }

  if (redirect) {
    // Preserve where the user tried to go (useful after login)
    return <Navigate to={redirect} replace state={{ from: loc.pathname }} />;
  }

  return <>{children}</>;
}