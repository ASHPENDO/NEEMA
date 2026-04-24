import { useState } from "react";

import { useSubscription } from "@/features/billing/hooks/useSubscription";
import { usePayment } from "@/features/billing/hooks/usePayment";

import { SubscriptionStatusCard } from "@/features/billing/components/SubscriptionStatusCard";
import { PaymentButton } from "@/features/billing/components/PaymentButton";
import { PaymentStatus } from "@/features/billing/components/PaymentStatus";

export default function BillingPage() {
  const { subscription, loading, refresh } = useSubscription();

  // 🔥 Pass refresh into payment hook
  const { pay, loading: paying, status } = usePayment(refresh);

  const [phone, setPhone] = useState("");

  if (loading) return <p>Loading...</p>;
  if (!subscription) return <p>No subscription data</p>;

  const tenantId = subscription.id || (subscription as any).tenant_id;
  const resolvedPhone = subscription.phone_number || phone;

  return (
    <div className="p-6 max-w-xl mx-auto">
      <SubscriptionStatusCard subscription={subscription} />

      {subscription.subscription_status === "expired" && (
        <>
          {!subscription.phone_number && (
            <input
              type="text"
              placeholder="Enter phone (e.g. 2547XXXXXXXX)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-4 w-full border rounded-lg px-3 py-2"
            />
          )}

          <PaymentButton
            loading={paying}
            onPay={() => pay(resolvedPhone, tenantId)}
          />

          <PaymentStatus status={status} />
        </>
      )}
    </div>
  );
}