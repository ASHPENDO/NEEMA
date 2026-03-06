// frontend/src/pages/Dashboard.tsx
import React, { useMemo } from "react";
import { useAuth } from "../auth/AuthContext";
import { Button } from "../components/Button";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { activeTenantStorage } from "../lib/tenantStorage";
import { useAccess } from "../hooks/useAccess";

export default function Dashboard() {
  const { me, logout } = useAuth();
  const nav = useNavigate();

  const tenantId = useMemo(() => activeTenantStorage.get(), []);
  const { membership, error: memError, can, ready } = useAccess();

  const role = membership?.role ?? null;

  const canSeeMembers = can("tenant.members.read");
  const canSeeInvites = can("tenant.invites.manage");
  const canSeeCatalog = can("catalog.read");

  const showTools = Boolean(tenantId) && (canSeeMembers || canSeeInvites || canSeeCatalog);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-xs font-semibold tracking-wide text-slate-500">POSTIKA</div>
              <h1 className="mt-1 text-2xl font-semibold text-slate-900">Dashboard</h1>
              <p className="mt-2 text-sm text-slate-600">
                Workspace home. Use the actions below to access tenant features.
              </p>

              <div className="mt-3 text-sm text-slate-700">
                Active tenant:{" "}
                <span className="font-medium">{tenantId ? tenantId : "— (select a workspace)"}</span>
                {tenantId && (
                  <>
                    {" "}
                    • Role: <span className="font-medium">{ready ? role ?? "—" : "Resolving..."}</span>
                  </>
                )}
              </div>

              {memError && <div className="mt-2 text-xs text-red-600">{memError}</div>}
            </div>

            <div className="flex flex-wrap gap-2">
              {canSeeMembers && <Button onClick={() => nav("/tenant-members")}>Members</Button>}

              {canSeeInvites && <Button onClick={() => nav("/tenant-invitations")}>Invitations</Button>}

              {canSeeCatalog && <Button onClick={() => nav("/catalog")}>Catalog</Button>}

              <Button variant="secondary" onClick={logout}>
                Log out
              </Button>
            </div>
          </div>

          {!tenantId && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              No active tenant selected. Choose or create a workspace before accessing tenant tools.
            </div>
          )}

          {tenantId && ready && !showTools && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              You do not currently have access to Members, Invitations, or Catalog for this tenant.
            </div>
          )}

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">Members</div>
              <div className="mt-1 text-sm text-slate-600">
                View and manage tenant workspace members.
              </div>
              <div className="mt-3">
                <Button
                  variant="secondary"
                  onClick={() => nav("/tenant-members")}
                  disabled={!canSeeMembers}
                >
                  Open Members
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">Invitations</div>
              <div className="mt-1 text-sm text-slate-600">
                Invite new tenant users and manage pending invitations.
              </div>
              <div className="mt-3">
                <Button
                  variant="secondary"
                  onClick={() => nav("/tenant-invitations")}
                  disabled={!canSeeInvites}
                >
                  Open Invitations
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">Catalog</div>
              <div className="mt-1 text-sm text-slate-600">
                Manage products, create catalog items, and run bulk uploads.
              </div>
              <div className="mt-3">
                <Button
                  variant="secondary"
                  onClick={() => nav("/catalog")}
                  disabled={!canSeeCatalog}
                >
                  Open Catalog
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-900">Current user</div>
            <pre className="mt-2 overflow-auto text-xs text-slate-700">{JSON.stringify(me, null, 2)}</pre>
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-900">Current membership</div>
            <pre className="mt-2 overflow-auto text-xs text-slate-700">
              {JSON.stringify(membership, null, 2)}
            </pre>
          </div>
        </motion.div>
      </div>
    </div>
  );
}