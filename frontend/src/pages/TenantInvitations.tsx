// frontend/src/pages/TenantInvitations.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "../lib/api";
import { activeTenantStorage } from "../lib/tenantStorage";
import {
  createTenantInvitation,
  listTenantInvitations,
  revokeTenantInvitation,
  resendTenantInvitation,
  type TenantInvitation,
  type TenantRole,
} from "../lib/api";
import { PageShell } from "../components/PageShell";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { normalizeEmail, isValidEmail } from "../lib/validators";

const ROLE_OPTIONS: TenantRole[] = ["OWNER", "ADMIN", "MANAGER", "STAFF"];

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString();
}

function computeStatus(inv: TenantInvitation): string {
  const anyInv = inv as any;
  if (typeof anyInv.status === "string" && anyInv.status.trim().length > 0) return anyInv.status;
  if (inv.accepted_at) return "accepted";
  if (inv.expires_at) {
    const exp = new Date(inv.expires_at);
    if (!Number.isNaN(exp.getTime()) && exp.getTime() < Date.now()) return "expired";
  }
  return "pending";
}

// Status badge
function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    accepted: "bg-emerald-50 text-emerald-700 border-emerald-200",
    pending:  "bg-amber-50 text-amber-700 border-amber-200",
    expired:  "bg-slate-100 text-slate-500 border-slate-200",
    revoked:  "bg-red-50 text-red-600 border-red-200",
  };
  const cls = colors[status.toLowerCase()] ?? colors.pending;
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${cls}`}>
      {status}
    </span>
  );
}

export default function TenantInvitations() {
  const nav = useNavigate();
  const tenantId = useMemo(() => activeTenantStorage.get(), []);

  const [items, setItems]           = useState<TenantInvitation[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [permissionDenied, setPermDenied] = useState(false);

  const [email, setEmail]           = useState("");
  const [role, setRole]             = useState<TenantRole>("STAFF");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError]   = useState<string | null>(null);

  const [resendingId, setResendingId] = useState<string | null>(null);
  const [revokingId, setRevokingId]   = useState<string | null>(null);

  const emailNorm  = useMemo(() => normalizeEmail(email), [email]);
  const emailError = email.length === 0 ? undefined : isValidEmail(emailNorm) ? undefined : "Enter a valid email address.";

  useEffect(() => {
    if (!tenantId) { nav("/tenant-selection", { replace: true }); return; }
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const data = await listTenantInvitations();
      const list = Array.isArray(data) ? data : (data as any)?.items;
      setItems(Array.isArray(list) ? list : []);
      setPermDenied(false);
    } catch (e) {
      const err = e as ApiError;
      if (err?.status === 403) { setPermDenied(true); setError("You do not have permission to manage invitations."); }
      else setError(err?.message ?? "Failed to load invitations.");
    } finally {
      setLoading(false);
    }
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!isValidEmail(emailNorm)) { setFormError("Please enter a valid email."); return; }
    setSubmitting(true);
    try {
      await createTenantInvitation({ email: emailNorm, role });
      setEmail("");
      setRole("STAFF");
      await refresh();
    } catch (e) {
      const err = e as ApiError;
      if (err?.status === 409) setFormError("This user is already a member of this workspace.");
      else if (err?.status === 403) { setPermDenied(true); setFormError("You do not have permission to invite members."); }
      else setFormError(err?.message ?? "Failed to create invitation.");
    } finally {
      setSubmitting(false);
    }
  }

  async function onResend(inviteId: string) {
    setResendingId(inviteId);
    try {
      await resendTenantInvitation(inviteId);
      await refresh();
    } catch (e) {
      const err = e as ApiError;
      if (err?.status === 409) alert(err?.message ?? "This invitation cannot be resent.");
      else if (err?.status === 403) { setPermDenied(true); alert("You do not have permission to resend invitations."); }
      else if (err?.status === 404) alert("Invitation not found.");
      else alert(err?.message ?? "Failed to resend invitation.");
    } finally {
      setResendingId(null);
    }
  }

  async function onRevoke(inviteId: string) {
    const ok = window.confirm("Revoke this invitation?");
    if (!ok) return;
    setRevokingId(inviteId);
    try {
      await revokeTenantInvitation(inviteId);
      await refresh();
    } catch (e) {
      const err = e as ApiError;
      if (err?.status === 409) alert(err?.message ?? "This invitation cannot be revoked.");
      else if (err?.status === 403) { setPermDenied(true); alert("You do not have permission to revoke invitations."); }
      else if (err?.status === 404) alert("Invitation not found.");
      else alert(err?.message ?? "Failed to revoke invitation.");
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <PageShell
      title="Tenant Invitations"
      subtitle="Invite your team members into this tenant."
    >
      <div className="space-y-6">
        {/* Permission banner */}
        {permissionDenied && (
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <svg className="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 1.5 1.5 13.5h13L8 1.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M8 6v4M8 11.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            You do not have permission to manage invitations in this tenant.
          </div>
        )}

        {/* Invite form */}
        <form onSubmit={onCreate} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-3">
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Invitee email
              </label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="team@company.com"
                disabled={permissionDenied}
              />
              {emailError && (
                <p className="mt-1.5 text-xs text-red-600">{emailError}</p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as TenantRole)}
                disabled={permissionDenied}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm transition hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50"
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>

          {formError && (
            <p className="mt-3 text-sm text-red-600">{formError}</p>
          )}

          <div className="mt-4 flex gap-2">
            <Button
              type="submit"
              disabled={submitting || !!emailError || email.length === 0 || permissionDenied}
              loading={submitting}
            >
              {submitting ? "Inviting…" : "Send invitation"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => nav("/dashboard")}>
              Back
            </Button>
          </div>
        </form>

        {/* Invitations table */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-3">
            <h2 className="text-sm font-semibold text-slate-800">Invitations</h2>
            <Button type="button" variant="secondary" onClick={refresh} disabled={loading}>
              {loading ? "Loading…" : "Refresh"}
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center gap-2.5 px-6 py-8 text-sm text-slate-500">
              <svg className="h-4 w-4 animate-spin text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading…
            </div>
          ) : error ? (
            <p className="px-6 py-6 text-sm text-red-600">{error}</p>
          ) : items.length === 0 ? (
            <p className="px-6 py-8 text-sm text-slate-500">No invitations yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Email</th>
                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Role</th>
                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Status</th>
                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Expires</th>
                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Created</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {items.map((inv) => {
                    const status  = computeStatus(inv);
                    const rowBusy = resendingId === inv.id || revokingId === inv.id;
                    const showActions = status === "pending" && !permissionDenied;

                    return (
                      <tr key={inv.id} className="transition hover:bg-slate-50/60">
                        <td className="px-5 py-3 font-medium text-slate-800">{inv.email}</td>
                        <td className="px-5 py-3 text-slate-600">{inv.role}</td>
                        <td className="px-5 py-3"><StatusBadge status={status} /></td>
                        <td className="px-5 py-3 text-slate-500">{formatDate(inv.expires_at)}</td>
                        <td className="px-5 py-3 text-slate-500">{formatDate(inv.created_at)}</td>
                        <td className="px-5 py-3 text-right">
                          {showActions ? (
                            <div className="inline-flex gap-2">
                              <Button
                                type="button"
                                variant="secondary"
                                disabled={rowBusy}
                                onClick={() => onResend(inv.id)}
                              >
                                {resendingId === inv.id ? "Resending…" : "Resend"}
                              </Button>
                              <Button
                                type="button"
                                variant="danger"
                                disabled={rowBusy}
                                onClick={() => onRevoke(inv.id)}
                              >
                                {revokingId === inv.id ? "Revoking…" : "Revoke"}
                              </Button>
                            </div>
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
          )}
        </div>
      </div>
    </PageShell>
  );
}
