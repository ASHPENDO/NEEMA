import { useEffect, useState } from "react";
import { onPaywallOpen } from "@/lib/paywall";
import { PaywallModal } from "@/features/billing/components/PaywallModal";

export default function GlobalPaywall() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => setOpen(true);
    onPaywallOpen(handler);
  }, []);

  if (!open) return null;

  return <PaywallModal open={open} onClose={() => setOpen(false)} />;
}