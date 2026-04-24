import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export function useSubscription() {
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchSubscription = async () => {
    try {
      const res = await api.get("/tenants/me"); // adjust if needed
      setSubscription(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscription();
  }, []);

  return { subscription, loading, refresh: fetchSubscription };
}