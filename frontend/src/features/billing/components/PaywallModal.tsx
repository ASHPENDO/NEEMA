import { motion } from "framer-motion";
import { PaymentButton } from "./PaymentButton";
import { PaymentStatus } from "./PaymentStatus";

export function PaywallModal({ open, onClose, onPay, loading, status }: any) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        className="bg-white p-6 rounded-2xl w-96"
      >
        <h2 className="text-xl font-bold">Subscription Required</h2>

        <p className="mt-2 text-gray-600">
          Your subscription has expired. Renew to continue.
        </p>

        <PaymentButton onPay={onPay} loading={loading} />
        <PaymentStatus status={status} />

        <button onClick={onClose} className="mt-4 text-sm text-gray-500">
          Close
        </button>
      </motion.div>
    </div>
  );
}