// src/pages/TenantMembers.tsx
import React, { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";

type Membership = {
  tenant_id: string;
  user_id: string;
  role: string;
  permissions: string[];
  is_active: boolean;
  accepted_terms: boolean;
  notifications_opt_in: boolean;
  referral_code: string | null;
  created_at: string;
};

export default function TenantMembers() {
  const [membership, setMembership] = useState<Membership | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        // ✅ Backend route exists: GET /api/v1/tenants/membership (tenant-scoped)
        const res = await api<Membership>("/api/v1/tenants/membership", { method: "GET" });

        if (!cancelled) {
          setMembership(res);
        }
      } catch (e) {
        if (cancelled) return;

        if (e instanceof ApiError) {
          // surface backend message (e.g., 401 Invalid token, 403 Forbidden, etc.)
          setError(e.message || `Request failed (${e.status})`);
        } else {
          setError("Request failed");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <div className="p-6">Loading membership…</div>;

  if (error) {
    return (
      <div className="p-6">
        <div className="text-red-600 font-medium">Members error</div>
        <div className="mt-2 text-sm">{error}</div>
        <div className="mt-4 text-xs opacity-70">
          Tip: If you see 401, your token likely expired — request/verify code again and refresh.
        </div>
      </div>
    );
  }

  if (!membership) {
    return (
      <div className="p-6">
        <div className="font-medium">No membership data</div>
        <div className="text-sm opacity-70 mt-2">Select a tenant and try again.</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">My Tenant Membership</h1>

      <div className="rounded-lg border p-4 space-y-2">
        <div className="text-sm">
          <span className="font-medium">Tenant ID:</span> {membership.tenant_id}
        </div>
        <div className="text-sm">
          <span className="font-medium">User ID:</span> {membership.user_id}
        </div>
        <div className="text-sm">
          <span className="font-medium">Role:</span> {membership.role}
        </div>
        <div className="text-sm">
          <span className="font-medium">Permissions:</span>{" "}
          {membership.permissions?.length ? membership.permissions.join(", ") : "(none)"}
        </div>
        <div className="text-sm">
          <span className="font-medium">Active:</span> {membership.is_active ? "Yes" : "No"}
        </div>
        <div className="text-sm">
          <span className="font-medium">Accepted Terms:</span> {membership.accepted_terms ? "Yes" : "No"}
        </div>
        <div className="text-sm">
          <span className="font-medium">Notifications Opt-in:</span>{" "}
          {membership.notifications_opt_in ? "Yes" : "No"}
        </div>
        <div className="text-sm">
          <span className="font-medium">Referral Code:</span> {membership.referral_code ?? "(none)"}
        </div>
        <div className="text-sm">
          <span className="font-medium">Created At:</span> {membership.created_at}
        </div>
      </div>

      <div className="text-xs opacity-70">
        Note: This endpoint returns <em>your</em> membership in the current tenant. We can add a true
        “list all tenant members” endpoint later (e.g. GET /api/v1/tenants/members) if needed.
      </div>
    </div>
  );
}