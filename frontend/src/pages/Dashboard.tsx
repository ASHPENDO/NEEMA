import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { Button } from "../components/Button";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
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

function canManage(role?: TenantRole | null) {
  return role === "OWNER" || role === "ADMIN";
}

export default function Dashboard() {
  const { me, logout } = useAuth();
  const nav = useNavigate();

  const tenantId = useMemo(() => activeTenantStorage.get(), []);

  const [membership, setMembership] = useState<MyMembership | null>(null);
  const [memError, setMemError] = useState<string | null>(null);

  const role = membership?.role ?? null;
  const showAdminTools = canManage(role);

  useEffect(() => {
    let cancelled = false;

    async function loadMembership() {
      setMemError(null);

      // If no tenant selected, don't call tenant-scoped endpoint.
      if (!tenantId) {
        setMembership(null);
        return;
      }

      try {
        const res = await api<MyMembership>("/api/v1/tenants/membership", { method: "GET" });
        if (!cancelled) setMembership(res);
      } catch (e) {
        if (cancelled) return;

        const err = e as ApiError;
        // Non-fatal: dashboard can still render even if membership fails.
        setMemError(err?.message ?? "Failed to load tenant membership.");
        setMembership(null);
      }
    }

    void loadMembership();
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold tracking-wide text-slate-500">POSTIKA</div>
              <h1 className="text-2xl font-semibold text-slate-900 mt-1">Dashboard</h1>
              <p className="text-sm text-slate-600 mt-2">
                Protected route placeholder. Replace this with your real dashboard layout.
              </p>

              <div className="mt-3 text-sm text-slate-700">
                Active tenant:{" "}
                <span className="font-medium">{tenantId ? tenantId : "— (select a workspace)"}</span>
                {tenantId && (
                  <>
                    {" "}
                    • Role: <span className="font-medium">{role ?? "—"}</span>
                  </>
                )}
              </div>

              {memError && (
                <div className="mt-2 text-xs text-red-600">
                  {memError}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              {/* Staff-safe: allow tenant selection always */}
              <Button variant="secondary" onClick={() => nav("/tenant-selection")}>
                Switch tenant
              </Button>

              {/* Admin tools: OWNER/ADMIN only */}
              {showAdminTools && (
                <>
                  <Button onClick={() => nav("/tenant-members")}>Members</Button>
                  <Button onClick={() => nav("/tenant-invitations")}>Invitations</Button>
                </>
              )}

              <Button variant="secondary" onClick={logout}>
                Log out
              </Button>
            </div>
          </div>

          {!showAdminTools && tenantId && (
            <div className="mt-4 rounded-xl bg-slate-50 border border-slate-200 p-4 text-sm text-slate-700">
              Admin tools (Members, Invitations) are available only to <span className="font-medium">Owners</span> and{" "}
              <span className="font-medium">Admins</span>.
            </div>
          )}

          <div className="mt-6 rounded-xl bg-slate-50 border border-slate-200 p-4">
            <div className="text-sm font-semibold text-slate-900">Current user</div>
            <pre className="text-xs text-slate-700 mt-2 overflow-auto">{JSON.stringify(me, null, 2)}</pre>
          </div>
        </motion.div>
      </div>
    </div>
  );
}