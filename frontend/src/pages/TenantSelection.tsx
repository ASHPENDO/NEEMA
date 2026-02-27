import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { getTenants, createTenant } from "../lib/api";
import { activeTenantStorage } from "../lib/tenantStorage";
import { Input } from "../components/Input";
import { Button } from "../components/Button";

type TenantOut = {
  id: string;
  name: string;
  tier?: string;
  is_active?: boolean;
};

const TenantSelection: React.FC = () => {
  const navigate = useNavigate();

  const [tenants, setTenants] = useState<TenantOut[]>([]);
  const [newTenantName, setNewTenantName] = useState("");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canCreate = useMemo(() => newTenantName.trim().length >= 2, [newTenantName]);

  // If a tenant is already selected, skip this page.
  useEffect(() => {
    const active = activeTenantStorage.get();
    if (active) {
      navigate("/dashboard", { replace: true });
    }
  }, [navigate]);

  // Fetch the list of tenants on mount
  useEffect(() => {
    const fetchTenants = async () => {
      setLoading(true);
      setError(null);
      try {
        const list = await getTenants<TenantOut[]>();
        setTenants(Array.isArray(list) ? list : []);
      } catch (err: any) {
        console.error(err);
        setError(err?.message || "Unable to load tenants");
      } finally {
        setLoading(false);
      }
    };
    fetchTenants();
  }, []);

  // Select a tenant and persist its ID
  const handleSelectTenant = (id: string) => {
    activeTenantStorage.set(id);
    navigate("/dashboard", { replace: true });
  };

  // Handle creating a new tenant (matches backend TenantCreate schema requirements)
  const handleCreateTenant = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canCreate || creating) return;

    setCreating(true);
    setError(null);

    try {
      const tenant = await createTenant<TenantOut>({
        name: newTenantName.trim(),
        accepted_terms: true, // required by backend
        tier: "sungura", // default; adjust if you add a selector
        notifications_opt_in: true, // optional; keep true for now
        // referral_code: undefined, // optional
      });

      // Persist as active tenant immediately and proceed
      activeTenantStorage.set(tenant.id);
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to create tenant");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-4">Select your workspace</h1>

      {error ? (
        <p className="text-red-500 mb-4">{error}</p>
      ) : null}

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Your workspaces</h2>

        {loading ? (
          <p className="text-slate-600">Loading…</p>
        ) : tenants.length > 0 ? (
          <ul className="space-y-2">
            {tenants.map((tenant) => (
              <li key={tenant.id} className="flex items-center justify-between p-2 border rounded-xl">
                <div className="flex flex-col">
                  <span className="font-medium">{tenant.name}</span>
                  {tenant.tier ? <span className="text-xs text-slate-500">Tier: {tenant.tier}</span> : null}
                </div>

                <Button onClick={() => handleSelectTenant(tenant.id)}>Select</Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-slate-600">No workspaces found. Create one below.</p>
        )}
      </section>

      <form onSubmit={handleCreateTenant} className="space-y-4">
        <h2 className="text-xl font-semibold mb-2">Create new workspace</h2>

        <Input
          label="Workspace name"
          type="text"
          value={newTenantName}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTenantName(e.target.value)}
          placeholder="e.g. Enda Motors"
        />

        <Button type="submit" loading={creating} disabled={creating || !canCreate} className="w-full">
          {creating ? "Creating…" : "Create workspace"}
        </Button>
      </form>
    </div>
  );
};

export default TenantSelection;