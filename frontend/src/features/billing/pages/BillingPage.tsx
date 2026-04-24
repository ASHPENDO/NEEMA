import { useSubscription } from "../hooks/useSubscription";
import { usePayment } from "../hooks/usePayment";
import { SubscriptionStatusCard } from "../components/SubscriptionStatusCard";
import { PaymentButton } from "../components/PaymentButton";
import { PaymentStatus } from "../components/PaymentStatus";

export default function BillingPage() {
  const { subscription, loading, refresh } = useSubscription();
  const { pay, loading: paying, status } = usePayment();

  if (loading) return <p>Loading...</p>;

  return (
    <div className="p-6 max-w-xl mx-auto">
      <SubscriptionStatusCard subscription={subscription} />

      {subscription?.subscription_status === "expired" && (
        <>
          <PaymentButton
            loading={paying}
            onPay={() => pay("254714701847", subscription.id)}
          />
          <PaymentStatus status={status} />
        </>
      )}
    </div>
  );
}