import React, { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";

type Member = {
  id: string;
  user_id?: string;
  email?: string;
  role: string;
  status?: string;
  created_at?: string;
};

export default function TenantMembers() {
  const [items, setItems] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);

        // backend endpoint you mentioned earlier
        const res = await api<{ items?: Member[] } | Member[]>("/api/v1/tenants/members", {
          method: "GET",
          auth: true,
        });

        const members = Array.isArray(res) ? res : res.items ?? [];
        setItems(members);
      } catch (e) {
        if (e instanceof ApiError) setError(e.message);
        else setError("Failed to load members.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="p-6 text-sm">Loading members…</div>;

  if (error) {
    return (
      <div className="p-6 text-sm">
        <div className="mb-2 font-semibold">Members error</div>
        <div className="text-red-700">{error}</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-4 font-semibold">Tenant Members</div>

      {items.length === 0 ? (
        <div className="text-sm opacity-80">No members found.</div>
      ) : (
        <div className="space-y-2">
          {items.map((m) => (
            <div key={m.id} className="rounded border p-3 text-sm">
              <div className="font-medium">{m.email ?? m.user_id ?? m.id}</div>
              <div className="opacity-80">Role: {m.role}</div>
              {m.status ? <div className="opacity-80">Status: {m.status}</div> : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}