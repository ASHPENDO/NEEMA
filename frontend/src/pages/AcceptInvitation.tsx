// frontend/src/pages/AcceptInvitation.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "../components/Button";
import { ApiError, acceptTenantInvitation } from "../lib/api";
import { activeTenantStorage } from "../lib/tenantStorage";
import { tokenStorage } from "../lib/storage";

function getDetail(e: unknown): any {
  if (e && typeof e === "object" && "detail" in (e as any)) return (e as any).detail;
  return undefined;
}

export default function AcceptInvitation() {
  const nav = useNavigate();
  const loc = useLocation();
  const [params] = useSearchParams();

  const token = useMemo(() => {
    const t = params.get("token");
    return t?.trim() || null;
  }, [params]);

  // ✅ Always includes leading "/" and is encoded:
  // /login?next=%2Faccept-invitation%3Ftoken%3D...
  const next = useMemo(() => {
    const path = `${loc.pathname}${loc.search}`;
    return encodeURIComponent(path.startsWith("/") ? path : `/${path}`);
  }, [loc.pathname, loc.search]);

  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function runAccept() {
    setError(null);

    if (!token) {
      setStatus("error");
      setError("Missing invitation token. Please open the full link from your email.");
      return;
    }

    // ✅ HARD RULE: if not logged in, go to login immediately (do not wait for a 401)
    if (!tokenStorage.get()) {
      nav(`/login?next=${next}`, { replace: true });
      return;
    }

    setStatus("loading");
    try {
      await acceptTenantInvitation(token);
      setStatus("success");

      // Clear stale tenant selection so TenantGate re-evaluates correctly
      activeTenantStorage.clear();

      nav("/tenant-gate", { replace: true });
    } catch (e) {
      const err = e as ApiError;
      setStatus("error");

      // If auth expired/invalid, bounce to login preserving return path
      if (err.status === 401) {
        nav(`/login?next=${next}`, { replace: true });
        return;
      }

      // ✅ 409: already accepted (backend: "Invitation already accepted")
      if (err.status === 409) {
        setError("Invitation already accepted. Continue to Tenant Gate.");
        return;
      }

      const detail = getDetail(err);

      // ✅ 400: expired (backend: "Invitation expired" / "token is required" / etc.)
      if (err.status === 400) {
        const msg = typeof detail === "string" ? detail : err.message;
        if (String(msg).toLowerCase().includes("expired")) {
          setError("This invitation has expired. Ask the admin to resend a new invitation link.");
          return;
        }
        setError(msg ?? "Failed to accept invitation.");
        return;
      }

      // ✅ 403: email mismatch / not allowed
      if (err.status === 403) {
        // backend returns:
        // { error: "INVITE_EMAIL_MISMATCH", message, invited_email, current_email }
        if (detail && typeof detail === "object" && detail.error === "INVITE_EMAIL_MISMATCH") {
          const invited = detail.invited_email ? String(detail.invited_email) : null;
          const current = detail.current_email ? String(detail.current_email) : null;

          if (invited && current) {
            setError(
              `This invitation is for ${invited}, but you are signed in as ${current}. Please log out and sign in with ${invited}, then reopen the invitation link.`
            );
            return;
          }
        }

        setError(
          "This invitation cannot be accepted (it may be expired, already used, or not meant for this account)."
        );
        return;
      }

      // 404: invalid token
      if (err.status === 404) {
        setError("Invalid invitation token. Please open the full link from your email, or ask the admin to resend it.");
        return;
      }

      setError(err.message ?? "Failed to accept invitation.");
    }
  }

  useEffect(() => {
    void runAccept();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

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
          <h1 className="text-2xl font-semibold text-slate-900 mt-1">Accept Invitation</h1>

          <p className="text-sm text-slate-600 mt-2">We’re confirming your invitation and adding you to the tenant.</p>

          <div className="mt-6 rounded-xl bg-slate-50 border border-slate-200 p-4">
            {status === "loading" && <p className="text-sm text-slate-700">Accepting invitation…</p>}
            {status === "success" && <p className="text-sm text-green-700">Invitation accepted. Redirecting…</p>}

            {status === "error" && (
              <div className="space-y-3">
                <p className="text-sm text-red-700">{error ?? "Something went wrong."}</p>

                <div className="flex flex-wrap gap-2">
                  <Button onClick={runAccept}>Try again</Button>

                  <Button variant="secondary" onClick={() => nav(`/login?next=${next}`, { replace: true })}>
                    Go to login
                  </Button>

                  <Button variant="secondary" onClick={() => nav("/tenant-gate", { replace: true })}>
                    Go to Tenant Gate
                  </Button>
                </div>
              </div>
            )}

            {status === "idle" && <p className="text-sm text-slate-700">Ready.</p>}
          </div>

          <div className="mt-4 text-xs text-slate-500">
            Tip: if you were logged out, log in first, then reopen the invitation link.
          </div>
        </motion.div>
      </div>
    </div>
  );
}