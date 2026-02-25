import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageShell } from "../components/PageShell";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { ApiError } from "../lib/api";
import { useAuth, isProfileComplete } from "../auth/AuthContext";

export default function ProfileCompletion() {
  const nav = useNavigate();
  const { me, updateMe } = useAuth();

  // Backend expects: full_name, phone_e164, country (optional)
  // Note: me currently may not have full_name/phone_e164 yet; keep safe fallbacks.
  const [fullName, setFullName] = useState((me as any)?.full_name ?? "");
  const [phoneE164, setPhoneE164] = useState((me as any)?.phone_e164 ?? "");
  const [password, setPassword] = useState(""); // optional UI-only for now (NOT sent to PATCH /auth/me)
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const nameErr = useMemo(() => {
    if (!fullName.trim()) return "Full name is required.";
    if (fullName.trim().length < 2) return "Name is too short.";
    return undefined;
  }, [fullName]);

  const phoneErr = useMemo(() => {
    const p = phoneE164.trim();
    if (!p) return "Phone number is required.";
    // Expect E.164 (e.g. +2547xxxxxxx)
    if (!p.startsWith("+")) return "Use international format, e.g. +2547...";
    if (p.length < 10) return "Enter a valid E.164 phone number.";
    return undefined;
  }, [phoneE164]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);

    if (nameErr || phoneErr) return;

    setLoading(true);
    try {
      // IMPORTANT:
      // - Only send fields allowed by backend schema (no extras)
      // - Do NOT send password here (backend forbids extra keys)
      await updateMe({
        full_name: fullName.trim(),
        phone_e164: phoneE164.trim(),
        country: "KE", // optional; remove if you prefer not to set automatically
      });

      // Clear optional password field (since it's not persisted yet)
      setPassword("");

      // after update, allow dashboard
      nav("/dashboard", { replace: true });
    } catch (err) {
      if (err instanceof ApiError) setServerError(err.message);
      else setServerError("Could not update your profile. Try again.");
    } finally {
      setLoading(false);
    }
  }

  // If already complete, avoid trapping user
  if (isProfileComplete(me)) {
    nav("/dashboard", { replace: true });
  }

  return (
    <PageShell
      title="Complete your profile"
      subtitle="Add your basic details to finish setting up your account."
    >
      {serverError ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {serverError}
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          label="Full name"
          autoComplete="name"
          placeholder="Dennis Kipkemoi"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          error={nameErr}
        />

        <Input
          label="Phone number (E.164)"
          autoComplete="tel"
          placeholder="+2547..."
          value={phoneE164}
          onChange={(e) => setPhoneE164(e.target.value)}
          error={phoneErr}
        />

        <Input
          label="Password (optional)"
          type="password"
          autoComplete="new-password"
          placeholder="Set a password (optional)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <Button type="submit" loading={loading} className="w-full">
          Save & continue
        </Button>
      </form>
    </PageShell>
  );
}