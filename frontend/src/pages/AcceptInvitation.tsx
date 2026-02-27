import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "../components/Button";
import { ApiError } from "../lib/api";
import { acceptTenantInvitation } from "../lib/api";

export default function AcceptInvitation() {
  const nav = useNavigate();
  const [params] = useSearchParams();

  const token = useMemo(() => {
    const t = params.get("token");
    return t?.trim() || null;
  }, [params]);

  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function runAccept() {
    setError(null);

    if (!token) {
      setStatus("error");
      setError("Missing invitation token. Please open the full link from your email.");
      return;
    }

    setStatus("loading");
    try {
      await acceptTenantInvitation(token);
      setStatus("success");

      // Let TenantGate refresh memberships and route appropriately
      nav("/tenant-gate", { replace: true });
    } catch (e) {
      const err = e as ApiError;
      setStatus("error");

      // Helpful messaging for common auth cases
      if (err.status === 401) {
        setError("You need to be logged in to accept this invitation. Please log in, then open this link again.");
      } else if (err.status === 403) {
        setError("This invitation cannot be accepted (it may be expired, already used, or not meant for this account).");
      } else {
        setError(err.message ?? "Failed to accept invitation.");
      }
    }
  }

  useEffect(() => {
    // Auto-run on page load
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

                  <Button variant="secondary" onClick={() => nav("/login")}>
                    Go to login
                  </Button>

                  <Button variant="secondary" onClick={() => nav("/tenant-gate")}>
                    Go to Tenant Gate
                  </Button>
                </div>
              </div>
            )}

            {status === "idle" && (
              <p className="text-sm text-slate-700">Ready.</p>
            )}
          </div>

          <div className="mt-4 text-xs text-slate-500">
            Tip: if you were logged out, log in first, then reopen the invitation link.
          </div>
        </motion.div>
      </div>
    </div>
  );
}