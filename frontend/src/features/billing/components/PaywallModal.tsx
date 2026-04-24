import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

export function PaywallModal({ open, onClose }: any) {
  const navigate = useNavigate();

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

        <button
          onClick={() => navigate("/billing")}
          className="mt-4 w-full bg-black text-white py-2 rounded-xl"
        >
          Go to Billing
        </button>

        <button onClick={onClose} className="mt-3 text-sm text-gray-500">
          Close
        </button>
      </motion.div>
    </div>
  );
}