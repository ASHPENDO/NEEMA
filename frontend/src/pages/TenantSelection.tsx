import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
// Adjust these imports to your actual project structure:
import { getTenants, createTenant } from "../lib/api";
import Input from "../components/Input";
import Button from "../components/Button";

/**
 * Allows an authenticated user to view their tenant memberships, pick one to use,
 * or create a new tenant. The selected tenant ID is stored in localStorage so
 * your API client can include it in the X‑Tenant‑Id header. After selection, the
 * user is redirected to the dashboard.
 */
const TenantSelection: React.FC = () => {
  const [tenants, setTenants] = useState<Array<{ id: string; name: string }>>([]);
  const [newTenantName, setNewTenantName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  // Fetch the list of tenants on mount
  useEffect(() => {
    const fetchTenants = async () => {
      try {
        const list = await getTenants();
        setTenants(Array.isArray(list) ? list : []);
      } catch (err: any) {
        console.error(err);
        setError(err?.message || "Unable to load tenants");
      }
    };
    fetchTenants();
  }, []);

  // Handle creating a new tenant
  const handleCreateTenant = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newTenantName.trim() || loading) return;
    setLoading(true);
    setError("");
    try {
      const tenant = await createTenant({ name: newTenantName.trim() });
      setTenants((prev) => [tenant, ...prev]);
      setNewTenantName("");
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to create tenant");
    } finally {
      setLoading(false);
    }
  };

  // Select a tenant and persist its ID
  const handleSelectTenant = (id: string) => {
    localStorage.setItem("tenantId", id);
    navigate("/dashboard"); // redirect to your post-selection page
  };

  return (
    <div className="max-w-xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-4">Select or Create Tenant</h1>
      {error && <p className="text-red-500 mb-4">{error}</p>}

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Your Tenants</h2>
        {tenants.length > 0 ? (
          <ul className="space-y-2">
            {tenants.map((tenant) => (
              <li
                key={tenant.id}
                className="flex items-center justify-between p-2 border rounded-md"
              >
                <span>{tenant.name}</span>
                <Button onClick={() => handleSelectTenant(tenant.id)}>
                  Select
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p>No tenants found. Please create one.</p>
        )}
      </section>

      <form onSubmit={handleCreateTenant} className="space-y-4">
        <h2 className="text-xl font-semibold mb-2">Create New Tenant</h2>
        <Input
          type="text"
          value={newTenantName}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setNewTenantName(e.target.value)
          }
          placeholder="Tenant name"
        />
        <Button type="submit" disabled={loading || !newTenantName.trim()}>
          {loading ? "Creating…" : "Create Tenant"}
        </Button>
      </form>
    </div>
  );
};

export default TenantSelection;