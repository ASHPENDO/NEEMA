export function SubscriptionStatusCard({ subscription }: any) {
  if (!subscription) return null;

  const { subscription_status, trial_ends_at, subscription_ends_at } = subscription;

  return (
    <div className="p-4 rounded-2xl shadow bg-white">
      <h2 className="text-lg font-semibold">Subscription</h2>

      <p className="mt-2">
        Status: <span className="font-bold">{subscription_status}</span>
      </p>

      {subscription_status === "trial" && (
        <p className="text-sm text-gray-500">
          Trial ends: {new Date(trial_ends_at).toLocaleDateString()}
        </p>
      )}

      {subscription_status === "active" && (
        <p className="text-sm text-gray-500">
          Active until: {new Date(subscription_ends_at).toLocaleDateString()}
        </p>
      )}

      {subscription_status === "expired" && (
        <p className="text-red-500 text-sm mt-2">
          Your subscription has expired
        </p>
      )}
    </div>
  );
}