import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageShell } from "../components/PageShell";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { ApiError } from "../lib/api";
import { normalizeOtp } from "../lib/validators";
import { useAuth, isProfileComplete } from "../auth/AuthContext";

export default function Verify() {
  const nav = useNavigate();
  const { getPendingEmail, clearPendingEmail, requestCode, verifyCode, me } = useAuth();

  const pendingEmail = getPendingEmail();

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const otp = useMemo(() => normalizeOtp(code), [code]);
  const otpError = code.length === 0 ? undefined : otp.length < 4 ? "Enter the code from your email." : undefined;

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    setInfo(null);

    if (!pendingEmail) {
      setServerError("Missing email. Please start again.");
      nav("/login");
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

      // After verifyCode we fetch /me; now route based on profile completion
      const complete = isProfileComplete(me);
      nav(complete ? "/dashboard" : "/complete-profile", { replace: true });
    } catch (err) {
      if (err instanceof ApiError) setServerError(err.message);
      else setServerError("Verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function onResend() {
    setServerError(null);
    setInfo(null);

    if (!pendingEmail) {
      setServerError("Missing email. Please start again.");
      nav("/login");
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

  return (
    <PageShell
      title="Verify code"
      subtitle={pendingEmail ? `Enter the code sent to ${pendingEmail}.` : "Enter the code from your email."}
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

        <Button type="button" variant="secondary" loading={resending} onClick={onResend} className="w-full">
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
