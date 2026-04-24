import { useState, useRef } from "react";
import { api } from "@/lib/api";

export function usePayment(refreshSubscription: () => Promise<any>) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "pending" | "success" | "failed">("idle");

  const intervalRef = useRef<any>(null);

  const stopPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const pollSubscription = () => {
    const MAX_ATTEMPTS = 20; // ~60 seconds
    let attempts = 0;

    intervalRef.current = setInterval(async () => {
      attempts++;

      const sub = await refreshSubscription();

      if (sub?.subscription_status === "active") {
        setStatus("success");
        stopPolling();
      }

      if (attempts >= MAX_ATTEMPTS) {
        setStatus("failed");
        stopPolling();
      }
    }, 3000);
  };

  const pay = async (phone: string, tenant_id: string) => {
    if (!phone || !tenant_id) {
      console.error("Missing phone or tenant_id");
      return;
    }

    setLoading(true);
    setStatus("pending");

    try {
      await api.post("/payments/mpesa/stk-push", {
        phone,
        amount: 10000,
        tenant_id,
      });

      // 🔥 Start polling AFTER request accepted
      pollSubscription();
    } catch (err) {
      console.error("Payment failed", err);
      setStatus("failed");
    } finally {
      setLoading(false);
    }
  };

  return { pay, loading, status };
}