import { useState, useRef } from "react";
import { api } from "@/lib/api";

export function usePayment(
  refreshSubscription: () => Promise<any>,
  refreshPayments?: () => Promise<void>,   // optional — keeps ledger live on success
) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "pending" | "success" | "failed">("idle");

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  // Polls /payments/status/{checkoutId} — deterministic, reads the ledger
  const pollStatus = (checkoutId: string) => {
    const MAX_ATTEMPTS = 20; // 20 × 3s = 60s timeout

    let attempts = 0;

    intervalRef.current = setInterval(async () => {
      attempts++;

      try {
        const res = await api.get(`/payments/status/${checkoutId}`);

        // Support both direct-data wrappers (res.status) and Axios-style (res.data.status)
        const paymentStatus: string = res.data?.status ?? res.status;

        if (paymentStatus === "success") {
          setStatus("success");
          stopPolling();
          await refreshSubscription();      // unlock subscription-gated UI
          await refreshPayments?.();        // sync ledger without page reload
          return;
        }

        if (paymentStatus === "failed") {
          setStatus("failed");
          stopPolling();
          return;
        }

        // paymentStatus === "pending" → keep polling
      } catch (err) {
        console.error("[pollStatus] error:", err);
        // network blip — don't stop, attempt limit will handle timeout
      }

      if (attempts >= MAX_ATTEMPTS) {
        console.warn("[pollStatus] 60s timeout — payment may still complete server-side");
        // Use "idle" rather than "failed": the payment isn't confirmed failed,
        // we just stopped watching. User can refresh to check subscription state.
        setStatus("idle");
        stopPolling();
      }
    }, 3000);
  };

  const pay = async (phone: string, tenant_id: string) => {
    if (!phone || !tenant_id) {
      console.error("[pay] Missing phone or tenant_id");
      return;
    }

    stopPolling(); // clear any stale interval from a previous attempt
    setLoading(true);
    setStatus("pending");

    try {
      const res = await api.post("/payments/mpesa/stk-push", {
        phone,
        amount: 10000,
        tenant_id,
      });

      const checkoutId = res.checkout_request_id;

      if (!checkoutId) {
        // Backend didn't return the ID — can't poll, fail immediately
        console.error("[pay] Missing checkout_request_id in response", res);
        setStatus("failed");
        return;
      }

      pollStatus(checkoutId);
    } catch (err) {
      console.error("[pay] STK push failed:", err);
      setStatus("failed");
    } finally {
      setLoading(false);
    }
  };

  return { pay, loading, status };
}