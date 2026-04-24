export function PaymentStatus({ status }: any) {
  if (status === "pending") return <p>Waiting for STK prompt...</p>;
  if (status === "success") return <p className="text-green-600">Payment sent. Check phone.</p>;
  if (status === "failed") return <p className="text-red-500">Payment failed. Try again.</p>;
  return null;
}