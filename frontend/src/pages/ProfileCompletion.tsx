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

  const [name, setName] = useState(me?.name ?? "");
  const [phone, setPhone] = useState(me?.phone_number ?? "");
  const [password, setPassword] = useState(""); // optional
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const nameErr = useMemo(() => {
    if (!name.trim()) return "Name is required.";
    if (name.trim().length < 2) return "Name is too short.";
    return undefined;
  }, [name]);

  const phoneErr = useMemo(() => {
    const p = phone.trim();
    if (!p) return "Phone number is required.";
    if (p.length < 8) return "Enter a valid phone number.";
    return undefined;
  }, [phone]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);

    if (nameErr || phoneErr) return;

    setLoading(true);
    try {
      await updateMe({
        name: name.trim(),
        phone_number: phone.trim(),
        ...(password.trim() ? { password: password.trim() } : {}),
      });

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
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={nameErr}
        />

        <Input
          label="Phone number"
          autoComplete="tel"
          placeholder="+2547..."
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
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
