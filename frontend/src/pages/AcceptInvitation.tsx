// frontend/src/pages/AcceptInvitation.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "../components/Button";
import { ApiError, acceptTenantInvitation } from "../lib/api";
import { activeTenantStorage } from "../lib/tenantStorage";
import { tokenStorage } from "../lib/storage";

const PENDING_INVITE_TOKEN_KEY = "postika.pendingInviteToken";

function setPendingInviteToken(token: string) {
  try {
    sessionStorage.setItem(PENDING_INVITE_TOKEN_KEY, token);
  } catch {
    // ignore
  }
}

function clearPendingInviteToken() {
  try {
    sessionStorage.removeItem(PENDING_INVITE_TOKEN_KEY);
  } catch {
    // ignore
  }
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

  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);

  async function runAccept() {
    setError(null);

    if (!token) {
      setStatus("error");
      clearPendingInviteToken();
      setError("Missing invitation token. Please open the full link from your email.");
      return;
    }

    // Persist token immediately so TenantGate can force the accept flow after login.
    setPendingInviteToken(token);

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

      // Clear the pending invite token to avoid redirect loops
      clearPendingInviteToken();

      nav("/tenant-gate", { replace: true });
    } catch (e) {
      const err = e as ApiError;
      setStatus("error");

      if (err.status === 401) {
        // Keep pending token; user needs to re-auth then accept.
        nav(`/login?next=${next}`, { replace: true });
        return;
      }

      // If token is invalid/expired/used, clear stored pending token so user isn't stuck.
      if (err.status === 404 || err.status === 400 || err.status === 410 || err.status === 409) {
        clearPendingInviteToken();
      }

      if (err.status === 403) {
        // Also clear to prevent loops if backend says it's not acceptable for this account.
        clearPendingInviteToken();
        setError(
          "This invitation cannot be accepted (it may be expired, already used, or not meant for this account)."
        );
        return;
      }

      // Prefer FastAPI detail if present
      const detail =
        (err as any)?.body?.detail ??
        (err as any)?.data?.detail ??
        (err as any)?.detail;

      setError(
        (typeof detail === "string" ? detail : null) ??
          err.message ??
          "Failed to accept invitation."
      );
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

          <p className="text-sm text-slate-600 mt-2">
            We’re confirming your invitation and adding you to the tenant.
          </p>

          <div className="mt-6 rounded-xl bg-slate-50 border border-slate-200 p-4">
            {status === "loading" && (
              <p className="text-sm text-slate-700">Accepting invitation…</p>
            )}
            {status === "success" && (
              <p className="text-sm text-green-700">Invitation accepted. Redirecting…</p>
            )}

            {status === "error" && (
              <div className="space-y-3">
                <p className="text-sm text-red-700">{error ?? "Something went wrong."}</p>

                <div className="flex flex-wrap gap-2">
                  <Button onClick={runAccept}>Try again</Button>

                  <Button
                    variant="secondary"
                    onClick={() => nav(`/login?next=${next}`, { replace: true })}
                  >
                    Go to login
                  </Button>

                  <Button
                    variant="secondary"
                    onClick={() => nav("/tenant-gate", { replace: true })}
                  >
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