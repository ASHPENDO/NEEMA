import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PageShell } from "../components/PageShell";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { ApiError } from "../lib/api";
import { useAuth, isProfileComplete } from "../auth/AuthContext";

function safeInternalPath(p: string | null | undefined): string | null {
  if (!p) return null;
  const v = String(p).trim();
  if (!v) return null;
  if (v.startsWith("/") && !v.startsWith("//")) return v;
  return null;
}

export default function ProfileCompletion() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { me, updateMe, getPendingInviteToken } = useAuth();

  const next = useMemo(() => safeInternalPath(params.get("next")), [params]);

  const [fullName, setFullName] = useState((me as any)?.full_name ?? "");
  const [phoneE164, setPhoneE164] = useState((me as any)?.phone_e164 ?? "");
  const [password, setPassword] = useState("");
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
    if (!p.startsWith("+")) return "Use international format, e.g. +2547...";
    if (p.length < 10) return "Enter a valid E.164 phone number.";
    return undefined;
  }, [phoneE164]);

  useEffect(() => {
    if (isProfileComplete(me)) {
      const pendingInviteToken = getPendingInviteToken();
      if (pendingInviteToken) {
        nav(`/accept-invitation?token=${encodeURIComponent(pendingInviteToken)}`, {
          replace: true,
        });
        return;
      }
      nav(next ?? "/tenant-gate", { replace: true });
    }
  }, [me, nav, next, getPendingInviteToken]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);

    if (nameErr || phoneErr) return;

    setLoading(true);
    try {
      await updateMe({
        full_name: fullName.trim(),
        phone_e164: phoneE164.trim(),
        country: "KE",
      });

      setPassword("");

      const pendingInviteToken = getPendingInviteToken();
      if (pendingInviteToken) {
        nav(`/accept-invitation?token=${encodeURIComponent(pendingInviteToken)}`, {
          replace: true,
        });
        return;
      }

      nav(next ?? "/tenant-gate", { replace: true });
    } catch (err) {
      if (err instanceof ApiError) setServerError(err.message);
      else setServerError("Could not update your profile. Try again.");
    } finally {
      setLoading(false);
    }
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