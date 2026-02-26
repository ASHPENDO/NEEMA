import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageShell } from "../components/PageShell";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { ApiError } from "../lib/api";
import { createTenant } from "../lib/api";
import { activeTenantStorage } from "../lib/tenantStorage";

export default function TenantCreate() {
  const nav = useNavigate();

  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);

    const trimmed = name.trim();
    if (!trimmed) {
      setServerError("Enter a tenant/business name.");
      return;
    }

    setLoading(true);
    try {
      const created = await createTenant({
        name: trimmed,
        accepted_terms: true,
        // Keep these explicit so backend doesn't reject if it enforces them later
        tier: "sungura",
        notifications_opt_in: true,
        // referral_code: "" // omit unless you have one
      });

      if (!created?.id) {
        throw new Error("Tenant created but no id returned.");
      }

      activeTenantStorage.set(created.id);
      nav("/dashboard", { replace: true });
    } catch (err) {
      if (err instanceof ApiError) setServerError(err.message);
      else setServerError("Could not create tenant. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageShell title="Create your workspace" subtitle="This will be your business/account workspace in POSTIKA.">
      {serverError ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {serverError}
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          label="Workspace name"
          placeholder="e.g. Dennis Electronics"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <Button type="submit" loading={loading} className="w-full">
          Create workspace
        </Button>

        <button
          type="button"
          onClick={() => nav("/tenant-gate")}
          className="w-full text-sm text-slate-600 hover:text-slate-900"
        >
          Back
        </button>
      </form>
    </PageShell>
  );
}