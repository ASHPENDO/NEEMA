// frontend/src/hooks/useTenantMembership.ts
import { useEffect, useState } from "react";
import { api, ApiError, type TenantRole } from "../lib/api";
import { activeTenantStorage, ACTIVE_TENANT_CHANGED_EVENT } from "../lib/tenantStorage";

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

export function clearTenantMembershipCache() {
  membershipCache.clear();
}

function getTenantId() {
  return activeTenantStorage.get();
}

export function useTenantMembership() {
  const [tenantId, setTenantId] = useState<string | null>(() => getTenantId());

  const [membership, setMembership] = useState<TenantMembership | null>(() => {
    const tid = getTenantId();
    return tid ? membershipCache.get(tid) ?? null : null;
  });

  const [loading, setLoading] = useState<boolean>(() => {
    const tid = getTenantId();
    return tid ? !membershipCache.has(tid) : false;
  });

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === "postika.activeTenantId") {
        setTenantId(getTenantId());
      }
    }

    function onTenantChanged() {
      setTenantId(getTenantId());
    }

    window.addEventListener("storage", onStorage);
    window.addEventListener(ACTIVE_TENANT_CHANGED_EVENT, onTenantChanged);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(ACTIVE_TENANT_CHANGED_EVENT, onTenantChanged);
    };
  }, []);

  useEffect(() => {
    if (!tenantId) {
      setMembership(null);
      setLoading(false);
      setError(null);
      return;
    }

    if (membershipCache.has(tenantId)) {
      setMembership(membershipCache.get(tenantId)!);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    async function fetchMembership() {
      // clear stale membership immediately when switching to a tenant
      // whose membership is not yet cached
      setMembership(null);
      setLoading(true);
      setError(null);

      try {
        const data = await api<TenantMembership>("/api/v1/tenants/membership", { method: "GET" });

        if (cancelled) return;

        membershipCache.set(tenantId, data);
        setMembership(data);
      } catch (e) {
        if (cancelled) return;

        const err = e as ApiError;
        setMembership(null);
        setError(err?.message ?? "Failed to fetch membership.");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
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
      const data = await api<TenantMembership>("/api/v1/tenants/membership", { method: "GET" });

      membershipCache.set(tenantId, data);
      setMembership(data);
    } catch (e) {
      const err = e as ApiError;
      setMembership(null);
      membershipCache.delete(tenantId);
      setError(err?.message ?? "Failed to refresh membership.");
    } finally {
      setLoading(false);
    }
  }

  return { tenantId, membership, loading, error, refresh };
}