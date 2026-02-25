import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { activeTenantStorage } from "../lib/tenantStorage";
import { useAuth, isProfileComplete } from "../auth/AuthContext";

type TenantOut = { id: string; name: string; tier: string; is_active: boolean };

export default function TenantGate() {
  const nav = useNavigate();
  const { isBootstrapping, isAuthed, me } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isBootstrapping) return;

    // Not logged in -> login
    if (!isAuthed) {
      nav("/login", { replace: true });
      return;
    }

    // Logged in but profile incomplete -> profile completion
    if (!isProfileComplete(me)) {
      nav("/profile-completion", { replace: true });
      return;
    }

    (async () => {
      try {
        // If already have an active tenant, proceed to dashboard
        const existing = activeTenantStorage.get();
        if (existing) {
          nav("/dashboard", { replace: true });
          return;
        }

        const tenants = await api<TenantOut[]>("/api/v1/tenants", {
          method: "GET",
          auth: true,
        });

        if (tenants.length === 0) {
          nav("/tenant-create", { replace: true });
          return;
        }

        if (tenants.length === 1) {
          activeTenantStorage.set(tenants[0].id);
          nav("/dashboard", { replace: true });
          return;
        }

        nav("/tenant-selection", { replace: true });
      } catch (e) {
        if (e instanceof ApiError) setError(e.message);
        else setError("Could not load tenants. Try again.");
      }
    })();
  }, [isBootstrapping, isAuthed, me, nav]);

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