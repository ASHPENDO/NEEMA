import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PageShell } from "../components/PageShell";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { ApiError } from "../lib/api";
import { normalizeOtp } from "../lib/validators";
import { useAuth } from "../auth/AuthContext";

// -----------------------------
// Helpers
// -----------------------------
function isProfileComplete(me: any): boolean {
  if (!me) return false;

  // Adjust based on your actual schema
  return Boolean(me.name && me.phone_number);
}

export default function Verify() {
  const nav = useNavigate();
  const [params] = useSearchParams();

  const {
    getPendingEmail,
    clearPendingEmail,
    requestCode,
    verifyCode,
    setPendingInviteToken,
    getPendingInviteToken,
    me,
  } = useAuth();

  const pendingEmail = getPendingEmail();

  useEffect(() => {
    const token = params.get("token");
    if (token && token.trim()) {
      setPendingInviteToken(token.trim());
    }
  }, [params, setPendingInviteToken]);

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const otp = useMemo(() => normalizeOtp(code), [code]);

  const otpError =
    code.length === 0
      ? undefined
      : otp.length < 4
      ? "Enter the code from your email."
      : undefined;

  // -----------------------------
  // Verify Handler
  // -----------------------------
  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    setInfo(null);

    if (!pendingEmail) {
      setServerError("Missing email. Please start again.");
      nav("/login", { replace: true });
      return;
    }

    if (otp.length < 4) {
      setServerError("Enter your verification code.");
      return;
    }

    setLoading(true);
    try {
      await verifyCode(pendingEmail, otp);
      clearPendingEmail();

      const pendingInvite = getPendingInviteToken();

      // 1. Invitation takes priority
      if (pendingInvite) {
        nav(
          `/accept-invitation?token=${encodeURIComponent(pendingInvite)}`,
          { replace: true }
        );
        return;
      }

      // 2. Profile incomplete → fix first
      if (!isProfileComplete(me)) {
        nav("/profile-completion", { replace: true });
        return;
      }

      // 3. Has tenant membership?
      const hasTenant = me?.tenants && me.tenants.length > 0;

      if (!hasTenant) {
        nav("/tenant-create", { replace: true });
        return;
      }

      // 4. Otherwise → dashboard
      nav("/dashboard", { replace: true });
    } catch (err) {
      if (err instanceof ApiError) setServerError(err.message);
      else setServerError("Verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // -----------------------------
  // Resend Handler
  // -----------------------------
  async function onResend() {
    setServerError(null);
    setInfo(null);

    if (!pendingEmail) {
      setServerError("Missing email. Please start again.");
      nav("/login", { replace: true });
      return;
    }

    setResending(true);
    try {
      await requestCode(pendingEmail);
      setInfo("A new code has been sent.");
    } catch (err) {
      if (err instanceof ApiError) setServerError(err.message);
      else setServerError("Could not resend code. Try again.");
    } finally {
      setResending(false);
    }
  }

  // -----------------------------
  // UI
  // -----------------------------
  return (
    <PageShell
      title="Verify code"
      subtitle={
        pendingEmail
          ? `Enter the code sent to ${pendingEmail}.`
          : "Enter the code from your email."
      }
    >
      {serverError ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {serverError}
        </div>
      ) : null}

      {info ? (
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {info}
        </div>
      ) : null}

      <form onSubmit={onVerify} className="space-y-4">
        <Input
          label="One-time code"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          error={otpError}
        />

        <Button type="submit" loading={loading} className="w-full">
          Verify & continue
        </Button>

        <Button
          type="button"
          variant="secondary"
          loading={resending}
          onClick={onResend}
          className="w-full"
        >
          Resend code
        </Button>

        <button
          type="button"
          onClick={() => nav("/login")}
          className="w-full text-sm text-slate-600 hover:text-slate-900"
        >
          Use a different email
        </button>
      </form>
    </PageShell>
  );
}