import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Subscription = {
  id: string;
  subscription_status: "trial" | "active" | "expired";
  trial_ends_at?: string;
  subscription_ends_at?: string;
  phone_number?: string;
};

export function useSubscription() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSubscription = async (): Promise<Subscription | null> => {
    try {
      const res = await api.get("/tenants/me");
      setSubscription(res);
      return res;
    } catch (err) {
      console.error("Failed to fetch subscription", err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscription();
  }, []);

  return { subscription, loading, refresh: fetchSubscription };
}