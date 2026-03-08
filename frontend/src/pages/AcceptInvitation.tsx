import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "../components/Button";
import { ApiError, acceptTenantInvitation } from "../lib/api";
import { activeTenantStorage } from "../lib/tenantStorage";
import { tokenStorage } from "../lib/storage";
import { useAuth } from "../auth/AuthContext";

function getDetail(e: unknown): any {
  if (e && typeof e === "object" && "details" in (e as any)) return (e as any).details;
  if (e && typeof e === "object" && "detail" in (e as any)) return (e as any).detail;
  return undefined;
}

export default function AcceptInvitation() {
  const nav = useNavigate();
  const loc = useLocation();
  const [params] = useSearchParams();
  const { setPendingInviteToken, clearPendingInviteToken } = useAuth();

  const token = useMemo(() => {
    const t = params.get("token");
    return t?.trim() || null;
  }, [params]);

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

    setPendingInviteToken(token);

    if (!tokenStorage.get()) {
      nav(`/login?next=${next}&token=${encodeURIComponent(token)}`, { replace: true });
      return;
    }

    setStatus("loading");

    try {
      const result = await acceptTenantInvitation(token);

      setStatus("success");
      clearPendingInviteToken();

      if (result?.tenant_id) {
        activeTenantStorage.set(result.tenant_id);
      } else {
        activeTenantStorage.clear();
      }

      nav("/tenant-gate", { replace: true });
    } catch (e) {
      const err = e as ApiError;
      setStatus("error");

      if (err.status === 401) {
        nav(`/login?next=${next}&token=${encodeURIComponent(token)}`, { replace: true });
        return;
      }

      if (err.status === 409) {
        clearPendingInviteToken();
        setError("Invitation already accepted. Continue to Tenant Gate.");
        return;
      }

      const detail = getDetail(err);

      if (err.status === 400) {
        const msg =
          typeof detail === "string"
            ? detail
            : typeof err.message === "string"
              ? err.message
              : "Failed to accept invitation.";

        if (String(msg).toLowerCase().includes("expired")) {
          clearPendingInviteToken();
          setError("This invitation has expired. Ask the admin to resend a new invitation link.");
          return;
        }

        setError(msg);
        return;
      }

      if (err.status === 403) {
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

      if (err.status === 404) {
        clearPendingInviteToken();
        setError(
          "Invalid invitation token. Please open the full link from your email, or ask the admin to resend it."
        );
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
      <div className="mx-auto max-w-xl px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="text-xs font-semibold tracking-wide text-slate-500">POSTIKA</div>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Accept Invitation</h1>

          <p className="mt-2 text-sm text-slate-600">
            We’re confirming your invitation and adding you to the tenant.
          </p>

          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
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
                    onClick={() =>
                      nav(
                        `/login?next=${next}${token ? `&token=${encodeURIComponent(token)}` : ""}`,
                        { replace: true }
                      )
                    }
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