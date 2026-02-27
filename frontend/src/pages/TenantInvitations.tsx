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
    // Keep tenant context guard (not RBAC)
    if (!tenantId) {
      nav("/tenant-selection", { replace: true });
      return;
    }
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh() {
    setLoading(true);
    setError(null);

    try {
      const data = await listTenantInvitations();
      const list = Array.isArray(data) ? data : (data as any)?.items;
      setItems(Array.isArray(list) ? list : []);
    } catch (e) {
      const err = e as ApiError;
      setError(err?.message ?? "Failed to load invitations.");
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

      if (err.status === 409) {
        setFormError("This user is already a member of this workspace.");
      } else if (err.status === 403) {
        setFormError("You don’t have permission to invite members.");
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

      if (err.status === 409) {
        alert(err?.message ?? "This invitation can’t be resent (accepted/revoked/expired).");
      } else if (err.status === 403) {
        alert("You don’t have permission to resend invitations.");
      } else if (err.status === 404) {
        alert("Invitation not found (it may have been revoked).");
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

      if (err.status === 409) {
        alert(err?.message ?? "This invitation can’t be revoked (accepted/revoked/expired).");
      } else if (err.status === 403) {
        alert("You don’t have permission to revoke invitations.");
      } else if (err.status === 404) {
        alert("Invitation not found (it may have been revoked).");
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
        {/* Create invitation */}
        <form onSubmit={onCreate} className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div className="md:col-span-2">
              <label className="block text-sm text-white/80 mb-1">Invitee email</label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="team@company.com" />
              {emailError && <p className="text-sm text-red-300 mt-1">{emailError}</p>}
            </div>

            <div>
              <label className="block text-sm text-white/80 mb-1">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as TenantRole)}
                className="w-full rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-white"
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r} className="bg-black">
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {formError && <p className="text-sm text-red-300">{formError}</p>}

          <div className="flex gap-2">
            <Button type="submit" disabled={submitting || !!emailError || email.length === 0}>
              {submitting ? "Inviting..." : "Send invitation"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => nav("/dashboard")}>
              Back to dashboard
            </Button>
          </div>
        </form>

        {/* List invitations */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-white">Invitations</h2>
            <Button type="button" variant="secondary" onClick={refresh} disabled={loading}>
              Refresh
            </Button>
          </div>

          {loading ? (
            <p className="text-white/70">Loading...</p>
          ) : error ? (
            <p className="text-red-300">{error}</p>
          ) : items.length === 0 ? (
            <p className="text-white/70">No invitations yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-white/70">
                  <tr className="border-b border-white/10">
                    <th className="text-left py-2 pr-3">Email</th>
                    <th className="text-left py-2 pr-3">Role</th>
                    <th className="text-left py-2 pr-3">Status</th>
                    <th className="text-left py-2 pr-3">Expires</th>
                    <th className="text-left py-2 pr-3">Created</th>
                    <th className="text-right py-2">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-white/90">
                  {items.map((inv) => {
                    const status = computeStatus(inv);
                    const rowBusy = resendingId === inv.id || revokingId === inv.id;
                    const canActOnThis = status === "pending";

                    return (
                      <tr key={inv.id} className="border-b border-white/5">
                        <td className="py-2 pr-3">{inv.email}</td>
                        <td className="py-2 pr-3">{inv.role}</td>
                        <td className="py-2 pr-3">{status}</td>
                        <td className="py-2 pr-3">{formatDate(inv.expires_at)}</td>
                        <td className="py-2 pr-3">{formatDate(inv.created_at)}</td>
                        <td className="py-2 text-right">
                          <div className="inline-flex gap-2">
                            <Button
                              type="button"
                              variant="secondary"
                              disabled={rowBusy || !canActOnThis}
                              onClick={() => onResend(inv.id)}
                            >
                              {resendingId === inv.id ? "Resending..." : "Resend"}
                            </Button>
                            <Button
                              type="button"
                              variant="danger"
                              disabled={rowBusy || !canActOnThis}
                              onClick={() => onRevoke(inv.id)}
                            >
                              {revokingId === inv.id ? "Revoking..." : "Revoke"}
                            </Button>
                          </div>
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