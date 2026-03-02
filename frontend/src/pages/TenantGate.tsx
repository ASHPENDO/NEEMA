// frontend/src/pages/TenantGate.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { activeTenantStorage } from "../lib/tenantStorage";
import { useAuth, isProfileComplete } from "../auth/AuthContext";

type TenantOut = { id: string; name: string; tier: string; is_active: boolean };

function safeInternalPath(p: string | null | undefined): string | null {
  if (!p) return null;
  const v = String(p).trim();
  if (!v) return null;
  // only allow internal paths
  if (v.startsWith("/") && !v.startsWith("//")) return v;
  return null;
}

export default function TenantGate() {
  const nav = useNavigate();
  const loc = useLocation();
  const [params] = useSearchParams();

  const { isBootstrapping, isAuthed, me, logout } = useAuth();
  const [error, setError] = useState<string | null>(null);

  // Intended destination priority:
  // 1) ?next=/somewhere (explicit)
  // 2) location.state.from (from RequirePermissions redirects)
  const intended = useMemo(() => {
    const nextQ = safeInternalPath(params.get("next"));
    if (nextQ) return nextQ;

    const fromState = safeInternalPath((loc.state as any)?.from);
    if (fromState) return fromState;

    return null;
  }, [params, loc.state]);

  useEffect(() => {
    if (isBootstrapping) return;

    // Not logged in -> login (preserve intended route)
    if (!isAuthed) {
      const next = encodeURIComponent(intended ?? "/tenant-gate");
      nav(`/login?next=${next}`, { replace: true });
      return;
    }

    // Logged in but profile incomplete -> profile completion (preserve intended route)
    if (!isProfileComplete(me)) {
      const next = encodeURIComponent(intended ?? "/tenant-gate");
      nav(`/profile-completion?next=${next}`, { replace: true });
      return;
    }

    (async () => {
      try {
        // If already have an active tenant, proceed to intended or dashboard
        const existing = activeTenantStorage.get();
        if (existing) {
          nav(intended ?? "/dashboard", { replace: true });
          return;
        }

        const tenants = await api<TenantOut[]>("/api/v1/tenants", {
          method: "GET",
          auth: true,
        });

        if (tenants.length === 0) {
          // After create tenant, app will set active tenant then route;
          // we preserve intended by passing next along.
          const next = intended ? `?next=${encodeURIComponent(intended)}` : "";
          nav(`/tenant-create${next}`, { replace: true });
          return;
        }

        if (tenants.length === 1) {
          activeTenantStorage.set(tenants[0].id);
          nav(intended ?? "/dashboard", { replace: true });
          return;
        }

        // Multiple tenants -> selection page (preserve intended)
        const next = intended ? `?next=${encodeURIComponent(intended)}` : "";
        nav(`/tenant-selection${next}`, { replace: true });
      } catch (e) {
        if (e instanceof ApiError) {
          // Token expired/invalid (or backend rejected auth)
          if (e.status === 401 || e.status === 403) {
            logout();
            const next = encodeURIComponent(intended ?? "/tenant-gate");
            nav(`/login?next=${next}`, { replace: true });
            return;
          }

          setError(e.message);
        } else {
          setError("Could not load tenants. Try again.");
        }
      }
    })();
  }, [isBootstrapping, isAuthed, me, nav, logout, intended]);

  if (error) {
    return (
      <div className="p-6 text-sm">
        <div className="mb-2 font-semibold">Tenant gate error</div>
        <div className="text-red-700">{error}</div>
      </div>
    );
  }

  return <div className="p-6 text-sm">Loading workspace…</div>;
}