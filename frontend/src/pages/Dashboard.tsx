// frontend/src/pages/Dashboard.tsx
import React from "react";
import { PageShell } from "../components/PageShell";
import { useAuth } from "../auth/AuthContext";
import { useAccess } from "../hooks/useAccess";
import MetaConnectButton from "../components/MetaConnectButton";

export default function Dashboard() {
  const { me } = useAuth();
  const { tenantId, membership, error, ready } = useAccess();

  return (
    <PageShell
      title="Dashboard"
      subtitle="Workspace overview for the currently selected tenant."
    >
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm font-semibold text-slate-900">Active tenant</div>
          <div className="mt-2 break-all text-sm text-slate-700">
            {tenantId || "—"}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm font-semibold text-slate-900">Role</div>
          <div className="mt-2 text-sm text-slate-700">
            {ready ? membership?.role ?? "—" : "Resolving..."}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm font-semibold text-slate-900">Profile</div>
          <div className="mt-2 text-sm text-slate-700">{me?.email || "—"}</div>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* META CONNECT TEST SECTION */}
      <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-4">
        <div className="text-sm font-semibold text-blue-900">
          Social Integrations (Testing)
        </div>
        <div className="mt-3">
          <MetaConnectButton />
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="text-sm font-semibold text-slate-900">
          Current membership
        </div>
        <pre className="mt-2 overflow-auto text-xs text-slate-700">
          {JSON.stringify(membership, null, 2)}
        </pre>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="text-sm font-semibold text-slate-900">Current user</div>
        <pre className="mt-2 overflow-auto text-xs text-slate-700">
          {JSON.stringify(me, null, 2)}
        </pre>
      </div>
    </PageShell>
  );
}