import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

export interface Payment {
  id: string;
  amount: number;
  status: "pending" | "success" | "failed";
  phone: string;
  receipt: string | null;
  created_at: string;
}

export function usePayments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await api.get("/payments");
      // Support both direct-data and Axios-style wrappers
      const data: Payment[] = res.data ?? res;
      setPayments(data);
    } catch (err) {
      console.error("[usePayments] fetch failed:", err);
      setError("Failed to load payment history");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  return { payments, loading, error, refresh: fetchPayments };
}