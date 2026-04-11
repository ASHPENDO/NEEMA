// frontend/src/pages/TenantMembers.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError, type TenantRole, type TenantMember } from "../lib/api";
import { activeTenantStorage } from "../lib/tenantStorage";
import { PageShell } from "../components/PageShell";
import { Button } from "../components/Button";
import { useAccess } from "../hooks/useAccess";

type UpdateTenantMemberRequest = {
  role?: TenantRole;
  is_active?: boolean;
};

// Role badge only — no role editing inline

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString();
}

// Pill color per role
function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    OWNER:   "bg-violet-50 text-violet-700 border-violet-200",
    ADMIN:   "bg-blue-50 text-blue-700 border-blue-200",
    MANAGER: "bg-amber-50 text-amber-700 border-amber-200",
    STAFF:   "bg-slate-50 text-slate-600 border-slate-200",
  };
  const cls = colors[role] ?? colors.STAFF;
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      {role}
    </span>
  );
}

export default function TenantMembers() {
  const nav = useNavigate();
  const tenantId = useMemo(() => activeTenantStorage.get(), []);
  const { can } = useAccess();

  const canReadMembers  = can("tenant.members.read");
  const canDeactivate   = can("tenant.members.write");

  const [items, setItems]               = useState<TenantMember[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [permissionDenied, setPermDenied] = useState(false);
  const [rowBusyId, setRowBusyId]       = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId) { nav("/tenant-selection", { replace: true }); return; }
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, canReadMembers]);

  async function refresh() {
    setLoading(true);
    setError(null);

    if (!canReadMembers) {
      setPermDenied(true);
      setItems([]);
      setLoading(false);
      return;
    }

    try {
      const res = await api<TenantMember[]>("/api/v1/tenants/members", { method: "GET" });
      setItems(Array.isArray(res) ? res : []);
      setPermDenied(false);
    } catch (e) {
      const err = e as ApiError;
      if (err?.status === 403) {
        setPermDenied(true);
        setItems([]);
        setError("You do not have permission to view tenant members.");
      } else {
        setError(err?.message ?? "Failed to load members.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function patchMember(memberUserId: string, payload: UpdateTenantMemberRequest) {
    return api<TenantMember>(`/api/v1/tenants/members/${memberUserId}`, {
      method: "PATCH",
      body: payload,
    });
  }

  async function onToggleActive(member: TenantMember, nextActive: boolean) {
    if (!canDeactivate) { setPermDenied(true); alert("Forbidden: you do not have permission to manage members."); return; }
    const ok = window.confirm(nextActive ? "Reactivate this member?" : "Deactivate this member?");
    if (!ok) return;
    setRowBusyId(member.user_id);
    try {
      const updated = await patchMember(member.user_id, { is_active: nextActive });
      setItems((prev) => prev.map((m) => (m.user_id === updated.user_id ? updated : m)));
    } catch (e) {
      const err = e as ApiError;
      if (err?.status === 409) alert(err.message ?? "This change is not allowed.");
      else if (err?.status === 403) { setPermDenied(true); alert("Forbidden: you do not have permission to manage members."); }
      else if (err?.status === 401) alert("Not authenticated. Please sign in again.");
      else alert(err?.message ?? "Failed to update member.");
    } finally {
      setRowBusyId(null);
    }
  }

  const readOnly = canReadMembers && !canDeactivate;

  return (
    <PageShell
      title="Tenant Members"
      subtitle="Manage who can access this tenant."
      right={
        <div className="flex gap-2">
          <Button variant="secondary" onClick={refresh} disabled={loading}>
            {loading ? "Loading…" : "Refresh"}
          </Button>
          <Button variant="secondary" onClick={() => nav("/dashboard")}>
            Back
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Permission / read-only banners */}
        {permissionDenied && (
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <svg className="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 1.5 1.5 13.5h13L8 1.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M8 6v4M8 11.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            You do not have permission to manage tenant members in this tenant.
          </div>
        )}
        {readOnly && (
          <div className="flex items-start gap-2.5 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
            <svg className="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M8 7v5M8 5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            You have read-only access to members. Editing roles and active status is disabled.
          </div>
        )}

        {/* Helper text */}
        <p className="text-sm text-slate-500">Members list for the currently selected tenant.</p>

        {/* Table card */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          {loading ? (
            <div className="flex items-center gap-2.5 px-6 py-8 text-sm text-slate-500">
              <svg className="h-4 w-4 animate-spin text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading members…
            </div>
          ) : error ? (
            <div className="px-6 py-6">
              <p className="font-semibold text-red-700">Error loading members</p>
              <p className="mt-1 text-sm text-slate-600">{error}</p>
              <p className="mt-3 text-xs text-slate-400">
                If you see 401, your token may have expired. Sign in again and retry.
              </p>
            </div>
          ) : items.length === 0 ? (
            <p className="px-6 py-8 text-sm text-slate-500">No members found.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Email</th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Role</th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Active</th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Joined</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">Actions</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {items.map((m) => {
                      const busy      = rowBusyId === m.user_id;
                      const canToggle = canDeactivate && !permissionDenied;

                      return (
                        <tr key={m.user_id} className="group transition hover:bg-slate-50/60">
                          <td className="px-4 py-3 font-medium text-slate-800">{m.email}</td>

                          <td className="px-4 py-3">
                            <RoleBadge role={m.role} />
                          </td>

                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${m.is_active ? "text-emerald-700" : "text-slate-400"}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${m.is_active ? "bg-emerald-500" : "bg-slate-300"}`} />
                              {m.is_active ? "Yes" : "No"}
                            </span>
                          </td>

                          <td className="px-4 py-3 text-slate-500">{formatDate(m.created_at)}</td>

                          <td className="px-4 py-3 text-right">
                            {canDeactivate ? (
                              <Button
                                variant={m.is_active ? "danger" : "secondary"}
                                disabled={busy || !canToggle}
                                onClick={() => onToggleActive(m, !m.is_active)}
                              >
                                {busy ? "Saving…" : m.is_active ? "Deactivate" : "Reactivate"}
                              </Button>
                            ) : (
                              <span className="text-xs text-slate-300">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-slate-100 bg-slate-50 px-4 py-3">
                <p className="text-xs text-slate-400">
                  Safety rules are enforced by the backend. For example, you cannot deactivate yourself or remove the last OWNER.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </PageShell>
  );
}
