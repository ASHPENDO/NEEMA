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

const ROLE_OPTIONS: TenantRole[] = ["OWNER", "ADMIN", "MANAGER", "STAFF"];

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString();
}

export default function TenantMembers() {
  const nav = useNavigate();
  const tenantId = useMemo(() => activeTenantStorage.get(), []);
  const { can } = useAccess();

  const canReadMembers = can("tenant.members.read");
  const canUpdateRole = can("tenant.members.write");
  const canDeactivate = can("tenant.members.write");

  const [items, setItems] = useState<TenantMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [permissionDenied, setPermissionDenied] = useState(false);
  const [rowBusyId, setRowBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId) {
      nav("/tenant-selection", { replace: true });
      return;
    }

    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, canReadMembers]);

  async function refresh() {
    setLoading(true);
    setError(null);

    if (!canReadMembers) {
      setPermissionDenied(true);
      setItems([]);
      setLoading(false);
      return;
    }

    try {
      const res = await api<TenantMember[]>("/api/v1/tenants/members", { method: "GET" });
      setItems(Array.isArray(res) ? res : []);
      setPermissionDenied(false);
    } catch (e) {
      const err = e as ApiError;

      if (err?.status === 403) {
        setPermissionDenied(true);
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

  async function onChangeRole(member: TenantMember, nextRole: TenantRole) {
    if (!canUpdateRole) {
      setPermissionDenied(true);
      alert("Forbidden: you do not have permission to change roles.");
      return;
    }

    setRowBusyId(member.user_id);
    try {
      const updated = await patchMember(member.user_id, { role: nextRole });
      setItems((prev) => prev.map((m) => (m.user_id === updated.user_id ? updated : m)));
    } catch (e) {
      const err = e as ApiError;

      if (err?.status === 409) {
        alert(err.message ?? "Role change not allowed.");
      } else if (err?.status === 403) {
        setPermissionDenied(true);
        alert("Forbidden: you do not have permission to change roles.");
      } else if (err?.status === 401) {
        alert("Not authenticated. Please sign in again.");
      } else {
        alert(err?.message ?? "Failed to update member.");
      }
    } finally {
      setRowBusyId(null);
    }
  }

  async function onToggleActive(member: TenantMember, nextActive: boolean) {
    if (!canDeactivate) {
      setPermissionDenied(true);
      alert("Forbidden: you do not have permission to manage members.");
      return;
    }

    const ok = window.confirm(nextActive ? "Reactivate this member?" : "Deactivate this member?");
    if (!ok) return;

    setRowBusyId(member.user_id);
    try {
      const updated = await patchMember(member.user_id, { is_active: nextActive });
      setItems((prev) => prev.map((m) => (m.user_id === updated.user_id ? updated : m)));
    } catch (e) {
      const err = e as ApiError;

      if (err?.status === 409) {
        alert(err.message ?? "This change is not allowed.");
      } else if (err?.status === 403) {
        setPermissionDenied(true);
        alert("Forbidden: you do not have permission to manage members.");
      } else if (err?.status === 401) {
        alert("Not authenticated. Please sign in again.");
      } else {
        alert(err?.message ?? "Failed to update member.");
      }
    } finally {
      setRowBusyId(null);
    }
  }

  const readOnly = canReadMembers && !canUpdateRole && !canDeactivate;

  return (
    <PageShell title="Tenant Members" subtitle="Manage who can access this tenant.">
      <div className="space-y-4">
        {permissionDenied && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            You do not have permission to manage tenant members in this tenant.
          </div>
        )}

        {readOnly && (
          <div className="rounded-2xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800">
            You have read-only access to members. Editing roles and active status is disabled.
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-600">Members list for the currently selected tenant.</div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={refresh} disabled={loading}>
              Refresh
            </Button>
            <Button variant="secondary" onClick={() => nav("/dashboard")}>
              Back
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          {loading ? (
            <p className="text-sm text-slate-600">Loading members...</p>
          ) : error ? (
            <div>
              <p className="font-medium text-red-700">Members error</p>
              <p className="mt-2 text-sm text-slate-700">{error}</p>
              <p className="mt-4 text-xs text-slate-500">
                If you see 401, your token may have expired. Sign in again and retry.
              </p>
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-slate-600">No members found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-slate-600">
                  <tr className="border-b border-slate-200">
                    <th className="py-2 pr-3">Email</th>
                    <th className="py-2 pr-3">Role</th>
                    <th className="py-2 pr-3">Active</th>
                    <th className="py-2 pr-3">Joined</th>
                    <th className="py-2 text-right">Actions</th>
                  </tr>
                </thead>

                <tbody className="text-slate-900">
                  {items.map((m) => {
                    const busy = rowBusyId === m.user_id;
                    const roleEditable = canUpdateRole && !permissionDenied;
                    const disableRole = busy || !roleEditable;

                    const canToggle = canDeactivate && !permissionDenied;
                    const disableToggle = busy || !canToggle;

                    return (
                      <tr key={m.user_id} className="border-b border-slate-100">
                        <td className="py-3 pr-3">{m.email}</td>

                        <td className="py-3 pr-3">
                          {roleEditable ? (
                            <select
                              value={m.role}
                              disabled={disableRole}
                              onChange={(e) => onChangeRole(m, e.target.value as TenantRole)}
                              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900"
                            >
                              {ROLE_OPTIONS.map((r) => (
                                <option key={r} value={r}>
                                  {r}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="inline-flex rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                              {m.role}
                            </span>
                          )}
                        </td>

                        <td className="py-3 pr-3">{m.is_active ? "Yes" : "No"}</td>
                        <td className="py-3 pr-3">{formatDate(m.created_at)}</td>

                        <td className="py-3 text-right">
                          {canDeactivate ? (
                            <Button
                              variant={m.is_active ? "danger" : "secondary"}
                              disabled={disableToggle}
                              onClick={() => onToggleActive(m, !m.is_active)}
                            >
                              {busy ? "Saving..." : m.is_active ? "Deactivate" : "Reactivate"}
                            </Button>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <p className="mt-3 text-xs text-slate-500">
                Safety rules are enforced by the backend. For example, you cannot deactivate yourself or remove the last
                OWNER.
              </p>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}