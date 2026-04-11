// src/pages/Dashboard.tsx
import React, { useState } from "react";
import { PageShell } from "../components/PageShell";
import { useAuth } from "../auth/AuthContext";
import { useAccess } from "../hooks/useAccess";
import MetaConnectButton from "../components/MetaConnectButton";
import CampaignList from "./CampaignList";

// ── Small collapsible debug panel ────────────────────────────────────────────
function DebugPanel({
  label,
  data,
}: {
  label: string;
  data: unknown;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-slate-100 focus-visible:outline-none"
      >
        <span className="text-sm font-semibold text-slate-700">{label}</span>
        <span className="text-slate-400 transition-transform duration-200" style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>

      {open && (
        <div className="border-t border-slate-200 px-4 py-3">
          <pre className="overflow-auto rounded-lg bg-white p-3 text-xs text-slate-700 border border-slate-100 leading-relaxed">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-2 truncate text-sm font-medium text-slate-800">{value || "—"}</div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { me } = useAuth();
  const { tenantId, membership, error, ready } = useAccess();

  return (
    <PageShell
      title="Dashboard"
      subtitle="Workspace overview for the currently selected tenant."
    >
      <div className="space-y-6">
        {/* ── Stat cards ── */}
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard
            label="Active tenant"
            value={
              tenantId ? (
                <span className="font-mono text-xs">{tenantId}</span>
              ) : (
                "—"
              )
            }
          />
          <StatCard
            label="Role"
            value={ready ? membership?.role : "Resolving…"}
          />
          <StatCard label="Profile" value={me?.email} />
        </div>

        {/* ── Error banner ── */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* ── Social integrations ── */}
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="text-sm font-semibold text-blue-900">
            Social Integrations <span className="ml-1.5 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-600">Testing</span>
          </div>
          <div className="mt-3">
            <MetaConnectButton />
          </div>
        </div>

        {/* ── Debug panels (collapsible) ── */}
        <div className="space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Debug info
          </div>
          <DebugPanel label="Current membership" data={membership} />
          <DebugPanel label="Current user" data={me} />
        </div>

        {/* ── Campaigns ── */}
        <div>
          <CampaignList />
        </div>
      </div>
    </PageShell>
  );
}
