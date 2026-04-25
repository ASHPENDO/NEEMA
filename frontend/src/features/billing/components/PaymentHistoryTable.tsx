export function PaymentHistoryTable({ payments }: any) {
  return (
    <div className="mt-6 border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2 text-left">Date</th>
            <th className="p-2 text-left">Amount</th>
            <th className="p-2 text-left">Phone</th>
            <th className="p-2 text-left">Status</th>
            <th className="p-2 text-left">Receipt</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((p: any) => (
            <tr key={p.id} className="border-t">
              <td className="p-2">
                {new Date(p.created_at).toLocaleString()}
              </td>
              <td className="p-2">KES {p.amount}</td>
              <td className="p-2">{p.phone}</td>
              <td className="p-2">
                <span
                  className={
                    p.status === "success"
                      ? "text-green-600"
                      : p.status === "failed"
                      ? "text-red-600"
                      : "text-yellow-600"
                  }
                >
                  {p.status}
                </span>
              </td>
              <td className="p-2">{p.receipt || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}