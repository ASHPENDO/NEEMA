// frontend/src/pages/TenantCreate.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { api, ApiError } from "../lib/api";
import { activeTenantStorage } from "../lib/tenantStorage";
import { useAuth, isProfileComplete } from "../auth/AuthContext";

const PENDING_INVITE_TOKEN_KEY = "postika.pendingInviteToken";

function safeInternalPath(p: string | null | undefined): string | null {
  if (!p) return null;
  const v = String(p).trim();
  if (!v) return null;
  if (v.startsWith("/") && !v.startsWith("//")) return v;
  return null;
}

function getPendingInviteToken(): string | null {
  try {
    const t = sessionStorage.getItem(PENDING_INVITE_TOKEN_KEY);
    if (!t) return null;
    const v = String(t).trim();
    return v ? v : null;
  } catch {
    return null;
  }
}

function extractDetail(err: unknown): any {
  const e = err as any;
  return e?.body?.detail ?? e?.data?.detail ?? e?.detail ?? null;
}

export default function TenantCreate() {
  const nav = useNavigate();
  const loc = useLocation();
  const [params] = useSearchParams();

  const { isBootstrapping, isAuthed, me, logout } = useAuth();

  const next = useMemo(() => safeInternalPath(params.get("next")), [params]);

  const [name, setName] = useState("");
  const [tier, setTier] = useState<"sungura" | "swara" | "ndovu">("sungura");
  const [acceptedTerms, setAcceptedTerms] = useState(true);
  const [notificationsOptIn, setNotificationsOptIn] = useState(true);
  const [referralCode, setReferralCode] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isBootstrapping) return;

    if (!isAuthed) {
      const dest = encodeURIComponent(`${loc.pathname}${loc.search}`);
      nav(`/login?next=${dest}`, { replace: true });
      return;
    }

    if (!isProfileComplete(me)) {
      const dest = encodeURIComponent(`${loc.pathname}${loc.search}`);
      nav(`/profile-completion?next=${dest}`, { replace: true });
      return;
    }

    // If a pending invite exists, user shouldn't be here; force accept flow.
    const pending = getPendingInviteToken();
    if (pending) {
      nav(`/accept-invitation?token=${encodeURIComponent(pending)}`, { replace: true });
      return;
    }
  }, [isBootstrapping, isAuthed, me, nav, loc.pathname, loc.search]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Workspace name is required.");
      return;
    }

    setSubmitting(true);
    try {
      const created = await api<{ id: string }>(`/api/v1/tenants`, {
        method: "POST",
        auth: true,
        body: {
          name: trimmedName,
          tier,
          accepted_terms: acceptedTerms,
          notifications_opt_in: notificationsOptIn,
          referral_code: referralCode.trim() || null,
        },
      });

      // Set active tenant and move on
      activeTenantStorage.set(created.id);
      nav(next ?? "/dashboard", { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        const detail = extractDetail(err);

        // Special-case: invited worker tries to create tenant
        if (
          (err.status === 403 || err.status === 400) &&
          detail &&
          typeof detail === "object" &&
          detail.code === "pending_invitation_exists"
        ) {
          const pending = getPendingInviteToken();
          if (pending) {
            nav(`/accept-invitation?token=${encodeURIComponent(pending)}`, { replace: true });
            return;
          }
          setError(detail.message ?? "You have a pending invitation. Accept it first.");
          return;
        }

        if (err.status === 401) {
          logout();
          const dest = encodeURIComponent(`${loc.pathname}${loc.search}`);
          nav(`/login?next=${dest}`, { replace: true });
          return;
        }

        if (typeof detail === "string") {
          setError(detail);
        } else if (detail && typeof detail === "object" && typeof detail.message === "string") {
          setError(detail.message);
        } else {
          setError(err.message ?? "Failed to create tenant.");
        }
        return;
      }

      setError("Failed to create tenant. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-xl mx-auto px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm"
        >
          <div className="text-xs font-semibold tracking-wide text-slate-500">POSTIKA</div>
          <h1 className="text-2xl font-semibold text-slate-900 mt-1">Create Workspace</h1>

          <p className="text-sm text-slate-600 mt-2">
            Create your first tenant workspace to start using POSTIKA.
          </p>

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Workspace name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. PWANI SALON & COSMETICS"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tier</label>
              <select
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                value={tier}
                onChange={(e) => setTier(e.target.value as any)}
              >
                <option value="sungura">sungura</option>
                <option value="swara">swara</option>
                <option value="ndovu">ndovu</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Referral code (optional)
              </label>
              <Input
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value)}
                placeholder="e.g. ASHLEY10"
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
              />
              I accept the Terms & Policies
            </label>

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={notificationsOptIn}
                onChange={(e) => setNotificationsOptIn(e.target.checked)}
              />
              I want to receive notifications
            </label>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creating…" : "Create workspace"}
              </Button>

              <Button
                type="button"
                variant="secondary"
                onClick={() => nav("/tenant-gate", { replace: true })}
                disabled={submitting}
              >
                Back to Tenant Gate
              </Button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
}