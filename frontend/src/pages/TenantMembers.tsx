import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { getTenantMembers, inviteTenantMember, removeTenantMember } from "../lib/api";
import { Input } from "../components/Input";
import { Button } from "../components/Button";

type Member = {
  id: string;
  email: string;
  role: string;
  status?: string;
};

export default function TenantMembers() {
  const navigate = useNavigate();

  const tenantId = useMemo(() => localStorage.getItem("tenantId") || "", []);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("STAFF");

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId) {
      navigate("/tenant");
      return;
    }

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getTenantMembers();
        setMembers(Array.isArray(res) ? res : res?.items ?? []);
      } catch (e: any) {
        console.error(e);
        setError(e?.message || "Failed to load tenant members");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [navigate, tenantId]);

  async function onInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setLoading(true);
    setError(null);
    try {
      await inviteTenantMember({ email: inviteEmail.trim(), role: inviteRole });
      setInviteEmail("");

      const res = await getTenantMembers();
      setMembers(Array.isArray(res) ? res : res?.items ?? []);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Failed to invite member");
    } finally {
      setLoading(false);
    }
  }

  async function onRemove(memberId: string) {
    setLoading(true);
    setError(null);
    try {
      await removeTenantMember(memberId);
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Failed to remove member");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Tenant Members</h1>
        <Button variant="secondary" onClick={() => navigate("/tenant")}>
          Change tenant
        </Button>
      </div>

      {error ? <div className="mb-4 text-red-600">{error}</div> : null}

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2">Invite a member</h2>

        <form onSubmit={onInvite} className="space-y-3">
          <Input
            label="Email"
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="staff@company.com"
          />

          <label className="block">
            <div className="text-sm font-medium text-slate-700 mb-1">Role</div>
            <select
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
            >
              <option value="OWNER">OWNER</option>
              <option value="ADMIN">ADMIN</option>
              <option value="MANAGER">MANAGER</option>
              <option value="AGENT">AGENT</option>
              <option value="STAFF">STAFF</option>
            </select>
          </label>

          <Button type="submit" loading={loading} disabled={!inviteEmail.trim()}>
            Send invite
          </Button>
        </form>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Current members</h2>

        {loading && members.length === 0 ? <div>Loading…</div> : null}

        {members.length === 0 ? (
          <div className="text-slate-600">No members found.</div>
        ) : (
          <ul className="space-y-2">
            {members.map((m) => (
              <li key={m.id} className="flex items-center justify-between p-3 border rounded-xl">
                <div>
                  <div className="font-medium">{m.email}</div>
                  <div className="text-sm text-slate-600">
                    {m.role}
                    {m.status ? ` • ${m.status}` : ""}
                  </div>
                </div>

                <Button variant="secondary" loading={loading} onClick={() => onRemove(m.id)}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}