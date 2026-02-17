import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageShell } from "../components/PageShell";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { normalizeEmail, isValidEmail } from "../lib/validators";
import { ApiError } from "../lib/api";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const nav = useNavigate();
  const { requestCode, setPendingEmail } = useAuth();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const emailNorm = useMemo(() => normalizeEmail(email), [email]);
  const emailError = email.length === 0 ? undefined : isValidEmail(emailNorm) ? undefined : "Enter a valid email address.";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);

    if (!isValidEmail(emailNorm)) {
      setServerError("Please enter a valid email.");
      return;
    }

    setLoading(true);
    try {
      await requestCode(emailNorm);
      setPendingEmail(emailNorm);
      nav("/verify");
    } catch (err) {
      if (err instanceof ApiError) setServerError(err.message);
      else setServerError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageShell
      title="Sign in"
      subtitle="Enter your email and we’ll send a one-time verification code."
    >
      {serverError ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {serverError}
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={emailError}
        />

        <Button type="submit" loading={loading} className="w-full">
          Send code
        </Button>

        <div className="text-xs text-slate-500">
          By continuing, you agree to POSTIKA’s Terms and Privacy Policy.
        </div>
      </form>
    </PageShell>
  );
}
