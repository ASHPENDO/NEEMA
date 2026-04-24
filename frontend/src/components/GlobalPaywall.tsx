import { useEffect, useState } from "react";
import { onPaywallOpen } from "@/lib/paywall";

import { PaywallModal } from "@/features/billing/components/PaywallModal";
import { useSubscription } from "@/features/billing/hooks/useSubscription";
import { usePayment } from "@/features/billing/hooks/usePayment";

export default function GlobalPaywall() {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");

  const { subscription, refresh } = useSubscription();
  const { pay, loading, status } = usePayment(refresh);

  useEffect(() => {
    const handler = () => setOpen(true);
    onPaywallOpen(handler);
  }, []);

  // 🔥 Auto-close on success
  useEffect(() => {
    if (status === "success") {
      setOpen(false);
    }
  }, [status]);

  if (!open) return null;

  const tenantId = subscription?.id || (subscription as any)?.tenant_id;
  const resolvedPhone = subscription?.phone_number || phone;

  return (
    <PaywallModal
      open={open}
      onClose={() => setOpen(false)}
      phone={phone}
      setPhone={setPhone}
      onPay={() => pay(resolvedPhone, tenantId)}
      loading={loading}
      status={status}
      hasPhone={!!subscription?.phone_number}
    />
  );
}