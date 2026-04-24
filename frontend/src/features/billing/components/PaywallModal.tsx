import { motion } from "framer-motion";
import { PaymentStatus } from "./PaymentStatus";

export function PaywallModal({
  open,
  onClose,
  onPay,
  loading,
  status,
  phone,
  setPhone,
  hasPhone,
}: any) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        className="bg-white p-6 rounded-2xl w-96"
      >
        <h2 className="text-xl font-bold">Subscription Required</h2>

        <p className="mt-2 text-gray-600">
          Your subscription has expired. Renew to continue.
        </p>

        {/* 📱 Phone input if missing */}
        {!hasPhone && (
          <input
            type="text"
            placeholder="Enter phone (2547XXXXXXXX)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-4 w-full border rounded-lg px-3 py-2"
          />
        )}

        {/* 💳 Pay button */}
        <button
          onClick={onPay}
          disabled={loading}
          className="mt-4 w-full bg-black text-white py-2 rounded-xl"
        >
          {loading ? "Processing..." : "Pay with M-PESA"}
        </button>

        {/* 📊 Status */}
        <PaymentStatus status={status} />

        {/* Close */}
        <button onClick={onClose} className="mt-3 text-sm text-gray-500">
          Close
        </button>
      </motion.div>
    </div>
  );
}