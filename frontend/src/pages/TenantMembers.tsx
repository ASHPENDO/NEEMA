// frontend/src/pages/TenantMembers.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError, type TenantRole, type TenantMember } from "../lib/api";
import { activeTenantStorage } from "../lib/tenantStorage";
import { PageShell } from "../components/PageShell";
import { Button } from "../components/Button";

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

type UpdateTenantMemberRequest = {
  role?: TenantRole;
  is_active?: boolean;
};

const ROLE_OPTIONS: TenantRole[] = ["OWNER", "ADMIN", "MANAGER", "STAFF"];

function canManageMembers(role?: TenantRole | null) {
  return role === "OWNER" || role === "ADMIN";
}

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString();
}

export default function TenantMembers() {
  const nav = useNavigate();
  const tenantId = useMemo(() => activeTenantStorage.get(), []);

  const [myMembership, setMyMembership] = useState<MyMembership | null>(null);
  const myRole = myMembership?.role ?? null;
  const canManage = canManageMembers(myRole);

  const [items, setItems] = useState<TenantMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [rowBusyId, setRowBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId) {
      nav("/tenant-selection", { replace: true });
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        // 1) Always fetch my membership (authoritative role for active tenant)
        const mem = await api<MyMembership>("/api/v1/tenants/membership", { method: "GET" });
        if (!cancelled) setMyMembership(mem);

        // 2) Only OWNER/ADMIN can list members
        const role = (mem?.role ?? "STAFF") as TenantRole;
        if (canManageMembers(role)) {
          const res = await api<TenantMember[]>("/api/v1/tenants/members", { method: "GET" });
          if (!cancelled) setItems(Array.isArray(res) ? res : []);
        } else {
          if (!cancelled) setItems([]);
        }
      } catch (e) {
        if (cancelled) return;

        if (e instanceof ApiError) {
          setError(e.message || `Request failed (${e.status})`);
        } else {
          setError("Request failed");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh() {
    setLoading(true);
    setError(null);

    try {
      const mem = await api<MyMembership>("/api/v1/tenants/membership", { method: "GET" });
      setMyMembership(mem);

      const role = (mem?.role ?? "STAFF") as TenantRole;
      if (canManageMembers(role)) {
        const res = await api<TenantMember[]>("/api/v1/tenants/members", { method: "GET" });
        setItems(Array.isArray(res) ? res : []);
      } else {
        setItems([]);
      }
    } catch (e) {
      const err = e as ApiError;
      setError(err?.message ?? "Failed to load members.");
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
    if (!canManage) return;

    setRowBusyId(member.user_id);
    try {
      const updated = await patchMember(member.user_id, { role: nextRole });
      setItems((prev) => prev.map((m) => (m.user_id === updated.user_id ? updated : m)));
    } catch (e) {
      const err = e as ApiError;

      if (err.status === 409) {
        alert(err.message ?? "Role change not allowed.");
      } else if (err.status === 403) {
        alert("You don’t have permission to change roles.");
      } else if (err.status === 401) {
        alert("Not authenticated. Please sign in again.");
      } else {
        alert(err.message ?? "Failed to update member.");
      }
    } finally {
      setRowBusyId(null);
    }
  }

  async function onToggleActive(member: TenantMember, nextActive: boolean) {
    if (!canManage) return;

    // client-side self guard (server also blocks)
    if (myMembership?.user_id && member.user_id === myMembership.user_id && nextActive === false) {
      alert("You cannot deactivate yourself.");
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

      if (err.status === 409) {
        alert(err.message ?? "This change is not allowed.");
      } else if (err.status === 403) {
        alert("You don’t have permission to manage members.");
      } else if (err.status === 401) {
        alert("Not authenticated. Please sign in again.");
      } else {
        alert(err.message ?? "Failed to update member.");
      }
    } finally {
      setRowBusyId(null);
    }
  }

  return (
    <PageShell title="Tenant Members" subtitle="Manage who can access this tenant.">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-white/80 text-sm">
            Your role: <span className="font-semibold text-white">{myRole ?? "—"}</span>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={refresh} disabled={loading}>
              Refresh
            </Button>
            <Button variant="secondary" onClick={() => nav("/dashboard")}>
              Back
            </Button>
          </div>
        </div>

        {!canManage && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white/80">
            Only <span className="font-semibold">Owners</span> and <span className="font-semibold">Admins</span> can
            manage members. You can still see your role above.
          </div>
        )}

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          {loading ? (
            <p className="text-white/70">Loading…</p>
          ) : error ? (
            <div>
              <p className="text-red-300 font-medium">Members error</p>
              <p className="mt-2 text-sm text-white/80">{error}</p>
              <p className="mt-4 text-xs text-white/50">
                Tip: If you see 401, your token likely expired — request/verify code again and refresh.
              </p>
            </div>
          ) : !canManage ? (
            <div className="text-white/70 text-sm">You don’t have access to the full members list.</div>
          ) : items.length === 0 ? (
            <p className="text-white/70">No members found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-white/70">
                  <tr className="border-b border-white/10">
                    <th className="text-left py-2 pr-3">Email</th>
                    <th className="text-left py-2 pr-3">Role</th>
                    <th className="text-left py-2 pr-3">Active</th>
                    <th className="text-left py-2 pr-3">Joined</th>
                    <th className="text-right py-2">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-white/90">
                  {items.map((m) => {
                    const busy = rowBusyId === m.user_id;

                    return (
                      <tr key={m.user_id} className="border-b border-white/5">
                        <td className="py-2 pr-3">{m.email}</td>

                        <td className="py-2 pr-3">
                          <select
                            value={m.role}
                            disabled={busy}
                            onChange={(e) => onChangeRole(m, e.target.value as TenantRole)}
                            className="rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-white"
                          >
                            {ROLE_OPTIONS.map((r) => (
                              <option key={r} value={r} className="bg-black">
                                {r}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className="py-2 pr-3">{m.is_active ? "Yes" : "No"}</td>
                        <td className="py-2 pr-3">{formatDate(m.created_at)}</td>

                        <td className="py-2 text-right">
                          <Button
                            variant={m.is_active ? "danger" : "secondary"}
                            disabled={busy}
                            onClick={() => onToggleActive(m, !m.is_active)}
                          >
                            {busy ? "Saving..." : m.is_active ? "Deactivate" : "Reactivate"}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <p className="mt-3 text-xs text-white/50">
                Safety rules: you can’t deactivate yourself; you can’t demote or deactivate the last OWNER. Backend
                enforces these rules even if the UI is bypassed.
              </p>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}