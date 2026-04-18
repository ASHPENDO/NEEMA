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
  if (v.startsWith("/") && !v.startsWith("//")) return v;
  return null;
}

export default function TenantGate() {
  const nav = useNavigate();
  const loc = useLocation();
  const [params] = useSearchParams();

  const { isBootstrapping, isAuthed, me, logout } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const intended = useMemo(() => {
    const nextQ = safeInternalPath(params.get("next"));
    if (nextQ) return nextQ;
    const fromState = safeInternalPath((loc.state as any)?.from);
    if (fromState) return fromState;
    return null;
  }, [params, loc.state]);

  useEffect(() => {
    if (isBootstrapping) return;

    if (!isAuthed) {
      const next = encodeURIComponent(intended ?? "/tenant-gate");
      nav(`/login?next=${next}`, { replace: true });
      return;
    }

    if (!isProfileComplete(me)) {
      const next = encodeURIComponent(intended ?? "/tenant-gate");
      nav(`/profile-completion?next=${next}`, { replace: true });
      return;
    }

    (async () => {
      try {
        // ── FAST PATH ──────────────────────────────────────────────────────
        // If we already have an active tenant in storage, trust it and
        // navigate immediately WITHOUT waiting for the API. The membership
        // fetch in useTenantMembership will validate it asynchronously.
        // This prevents the race condition where the API call returns before
        // the backend has fully indexed the new tenant, causing a false
        // "0 tenants → go to tenant-create" redirect loop.
        const existingBeforeFetch = activeTenantStorage.get();
        if (existingBeforeFetch) {
          nav(intended ?? "/dashboard", { replace: true });
          return;
        }

        // ── SLOW PATH: no active tenant in storage, must fetch ─────────────
        const tenants = await api<TenantOut[]>("/api/v1/tenants", {
          method: "GET",
          auth: true,
        });

        // Re-read storage — it may have been set while we were fetching
        // (e.g. another tab or a concurrent navigation)
        const activeAfterFetch = activeTenantStorage.get();

        // Validate: if stored tenant is not in the fetched list, clear it
        if (activeAfterFetch && !tenants.some((t) => t.id === activeAfterFetch)) {
          activeTenantStorage.clear();
        }

        const active = activeTenantStorage.get();

        if (active) {
          nav(intended ?? "/dashboard", { replace: true });
          return;
        }

        if (tenants.length === 0) {
          const next = intended ? `?next=${encodeURIComponent(intended)}` : "";
          nav(`/tenant-create${next}`, { replace: true });
          return;
        }

        if (tenants.length === 1) {
          activeTenantStorage.set(tenants[0].id);
          nav(intended ?? "/dashboard", { replace: true });
          return;
        }

        // Multiple tenants → selection
        const next = intended ? `?next=${encodeURIComponent(intended)}` : "";
        nav(`/tenant-selection${next}`, { replace: true });
      } catch (e) {
        if (e instanceof ApiError) {
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