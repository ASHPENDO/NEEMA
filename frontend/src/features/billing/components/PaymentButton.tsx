export function PaymentButton({ onPay, loading }: any) {
  return (
    <button
      onClick={onPay}
      disabled={loading}
      className="mt-4 w-full bg-black text-white py-2 rounded-xl"
    >
      {loading ? "Processing..." : "Pay with M-PESA"}
    </button>
  );
}