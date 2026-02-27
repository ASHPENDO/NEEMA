// frontend/src/hooks/useTenantMembership.ts
import { useEffect, useState } from "react";
import { api, ApiError, type TenantRole } from "../lib/api";
import { activeTenantStorage } from "../lib/tenantStorage";

/**
 * Authoritative tenant membership type
 */
export type TenantMembership = {
  tenant_id: string;
  user_id: string;
  role: TenantRole;
  permissions: string[];
  is_active: boolean;
  accepted_terms: boolean;
  notifications_opt_in: boolean;
  referral_code: string | null;
  created_at: string;
};

/**
 * Simple in-memory cache keyed by tenantId
 */
const membershipCache = new Map<string, TenantMembership>();

export function useTenantMembership() {
  const tenantId = activeTenantStorage.get();

  const [membership, setMembership] = useState<TenantMembership | null>(
    tenantId ? membershipCache.get(tenantId) ?? null : null
  );

  const [loading, setLoading] = useState<boolean>(
    tenantId ? !membershipCache.has(tenantId) : false
  );

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId) {
      setMembership(null);
      setLoading(false);
      return;
    }

    // If cached, no fetch needed
    if (membershipCache.has(tenantId)) {
      setMembership(membershipCache.get(tenantId)!);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchMembership() {
      setLoading(true);
      setError(null);

      try {
        const data = await api<TenantMembership>(
          "/api/v1/tenants/membership",
          { method: "GET" }
        );

        if (cancelled) return;

        membershipCache.set(tenantId, data);
        setMembership(data);
      } catch (e) {
        if (cancelled) return;

        const err = e as ApiError;
        setError(err?.message ?? "Failed to fetch membership.");
        setMembership(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchMembership();

    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  async function refresh() {
    if (!tenantId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await api<TenantMembership>(
        "/api/v1/tenants/membership",
        { method: "GET" }
      );

      membershipCache.set(tenantId, data);
      setMembership(data);
    } catch (e) {
      const err = e as ApiError;
      setError(err?.message ?? "Failed to refresh membership.");
    } finally {
      setLoading(false);
    }
  }

  return { membership, loading, error, refresh };
}