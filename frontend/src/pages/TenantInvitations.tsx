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

export default function TenantInvitations() {
  const nav = useNavigate();
  const tenantId = useMemo(() => activeTenantStorage.get(), []);

  const [items, setItems] = useState<TenantInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [permissionDenied, setPermissionDenied] = useState(false);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TenantRole>("STAFF");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [resendingId, setResendingId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const emailNorm = useMemo(() => normalizeEmail(email), [email]);
  const emailError =
    email.length === 0 ? undefined : isValidEmail(emailNorm) ? undefined : "Enter a valid email address.";

  useEffect(() => {
    if (!tenantId) {
      nav("/tenant-selection", { replace: true });
      return;
    }

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
      setPermissionDenied(false);
    } catch (e) {
      const err = e as ApiError;

      if (err?.status === 403) {
        setPermissionDenied(true);
        setError("You do not have permission to manage invitations.");
      } else {
        setError(err?.message ?? "Failed to load invitations.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!isValidEmail(emailNorm)) {
      setFormError("Please enter a valid email.");
      return;
    }

    setSubmitting(true);
    try {
      await createTenantInvitation({ email: emailNorm, role });
      setEmail("");
      setRole("STAFF");
      await refresh();
    } catch (e) {
      const err = e as ApiError;

      if (err?.status === 409) {
        setFormError("This user is already a member of this workspace.");
      } else if (err?.status === 403) {
        setPermissionDenied(true);
        setFormError("You do not have permission to invite members.");
      } else {
        setFormError(err?.message ?? "Failed to create invitation.");
      }
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

      if (err?.status === 409) {
        alert(err?.message ?? "This invitation cannot be resent.");
      } else if (err?.status === 403) {
        setPermissionDenied(true);
        alert("You do not have permission to resend invitations.");
      } else if (err?.status === 404) {
        alert("Invitation not found.");
      } else {
        alert(err?.message ?? "Failed to resend invitation.");
      }
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

      if (err?.status === 409) {
        alert(err?.message ?? "This invitation cannot be revoked.");
      } else if (err?.status === 403) {
        setPermissionDenied(true);
        alert("You do not have permission to revoke invitations.");
      } else if (err?.status === 404) {
        alert("Invitation not found.");
      } else {
        alert(err?.message ?? "Failed to revoke invitation.");
      }
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <PageShell title="Tenant Invitations" subtitle="Invite your team members into this tenant.">
      <div className="space-y-6">
        {permissionDenied && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            You do not have permission to manage invitations in this tenant.
          </div>
        )}

        <form onSubmit={onCreate} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
          <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-3">
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm text-slate-700">Invitee email</label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="team@company.com"
                disabled={permissionDenied}
              />
              {emailError && <p className="mt-1 text-sm text-red-600">{emailError}</p>}
            </div>

            <div>
              <label className="mb-1 block text-sm text-slate-700">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as TenantRole)}
                disabled={permissionDenied}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900"
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {formError && <p className="text-sm text-red-600">{formError}</p>}

          <div className="flex gap-2">
            <Button type="submit" disabled={submitting || !!emailError || email.length === 0 || permissionDenied}>
              {submitting ? "Inviting..." : "Send invitation"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => nav("/dashboard")}>
              Back
            </Button>
          </div>
        </form>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Invitations</h2>
            <Button type="button" variant="secondary" onClick={refresh} disabled={loading}>
              Refresh
            </Button>
          </div>

          {loading ? (
            <p className="text-sm text-slate-600">Loading...</p>
          ) : error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-slate-600">No invitations yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-slate-600">
                  <tr className="border-b border-slate-200">
                    <th className="py-2 pr-3">Email</th>
                    <th className="py-2 pr-3">Role</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Expires</th>
                    <th className="py-2 pr-3">Created</th>
                    <th className="py-2 text-right">Actions</th>
                  </tr>
                </thead>

                <tbody className="text-slate-900">
                  {items.map((inv) => {
                    const status = computeStatus(inv);
                    const rowBusy = resendingId === inv.id || revokingId === inv.id;
                    const showActions = status === "pending" && !permissionDenied;

                    return (
                      <tr key={inv.id} className="border-b border-slate-100">
                        <td className="py-3 pr-3">{inv.email}</td>
                        <td className="py-3 pr-3">{inv.role}</td>
                        <td className="py-3 pr-3 capitalize">{status}</td>
                        <td className="py-3 pr-3">{formatDate(inv.expires_at)}</td>
                        <td className="py-3 pr-3">{formatDate(inv.created_at)}</td>
                        <td className="py-3 text-right">
                          {showActions ? (
                            <div className="inline-flex gap-2">
                              <Button
                                type="button"
                                variant="secondary"
                                disabled={rowBusy}
                                onClick={() => onResend(inv.id)}
                              >
                                {resendingId === inv.id ? "Resending..." : "Resend"}
                              </Button>
                              <Button
                                type="button"
                                variant="danger"
                                disabled={rowBusy}
                                onClick={() => onRevoke(inv.id)}
                              >
                                {revokingId === inv.id ? "Revoking..." : "Revoke"}
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
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