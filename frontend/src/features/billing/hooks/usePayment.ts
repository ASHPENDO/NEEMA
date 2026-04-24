import { useState } from "react";
import { api } from "@/lib/api";

export function usePayment() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "pending" | "success" | "failed">("idle");

  const pay = async (phone: string, tenant_id: string) => {
    setLoading(true);
    setStatus("pending");

    try {
      await api.post("/payments/mpesa/stk-push", {
        phone,
        amount: 10000,
        tenant_id,
      });

      setStatus("success"); // optimistic
    } catch (err) {
      setStatus("failed");
    } finally {
      setLoading(false);
    }
  };

  return { pay, loading, status };
}