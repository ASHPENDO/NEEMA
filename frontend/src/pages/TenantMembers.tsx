import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import {
  getTenantMembers,
  inviteTenantMember,
  updateTenantMemberRole,
  removeTenantMember,
} from '../lib/api';
import Input from '../components/Input';
import Button from '../components/Button';

// A minimal member type; extend with your actual user properties
interface Member {
  id: string;
  email: string;
  name?: string;
  role: string;
  [key: string]: any;
}

// Allowed roles for membership; adjust or fetch from API as needed
const ROLE_OPTIONS = ['member', 'admin'];

const TenantMembers: React.FC = () => {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);

  // Determine whether the current user can manage members
  const canManage = !!(
    user &&
    (
      (Array.isArray((user as any).roles) && (user as any).roles.some((r: string) => r === 'owner' || r === 'admin')) ||
      (typeof (user as any).role === 'string' && ((user as any).role === 'owner' || (user as any).role === 'admin'))
    )
  );

  // Load members on mount
  useEffect(() => {
    const fetchMembers = async () => {
      setLoading(true);
      try {
        const result = await getTenantMembers<Member[]>();
        setMembers(result);
      } catch (err: any) {
        setError(err?.message ?? 'Failed to load members');
      } finally {
        setLoading(false);
      }
    };
    fetchMembers();
  }, []);

  // Invite a new member
  const handleInvite = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email.trim()) return;
    setInviteLoading(true);
    setError(null);
    try {
      const newMember = await inviteTenantMember<Member>({ email: email.trim(), role: inviteRole });
      setMembers((prev) => [...prev, newMember]);
      setEmail('');
      setInviteRole('member');
    } catch (err: any) {
      setError(err?.message ?? 'Failed to invite member');
    } finally {
      setInviteLoading(false);
    }
  };

  // Remove an existing member
  const handleRemove = async (id: string) => {
    if (!window.confirm('Are you sure you want to remove this member?')) return;
    try {
      await removeTenantMember(id);
      setMembers((prev) => prev.filter((m) => m.id !== id));
    } catch (err: any) {
      setError(err?.message ?? 'Failed to remove member');
    }
  };

  // Update a member’s role
  const handleRoleChange = async (id: string, newRole: string) => {
    try {
      const updated = await updateTenantMemberRole<Member>(id, newRole);
      setMembers((prev) => prev.map((m) => (m.id === id ? updated : m)));
    } catch (err: any) {
      setError(err?.message ?? 'Failed to update role');
    }
  };

  if (!canManage) {
    return <div className="p-4">You do not have permission to manage members.</div>;
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-4">Manage Members</h1>
      {error && <div className="text-red-500 mb-4">{error}</div>}

      {loading ? (
        <div>Loading members…</div>
      ) : (
        <ul className="space-y-2 mb-6">
          {members.length > 0 ? (
            members.map((member) => (
              <li
                key={member.id}
                className="flex items-center justify-between p-2 border rounded-md"
              >
                <div>
                  <div className="font-medium">{member.name || member.email}</div>
                  <div className="text-sm text-gray-500">{member.role}</div>
                </div>
                <div className="flex items-center space-x-2">
                  <select
                    value={member.role}
                    onChange={(e) => handleRoleChange(member.id, e.target.value)}
                    className="border rounded px-2 py-1"
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <Button onClick={() => handleRemove(member.id)}>Remove</Button>
                </div>
              </li>
            ))
          ) : (
            <li>No members yet.</li>
          )}
        </ul>
      )}

      {/* Invitation form */}
      <form onSubmit={handleInvite} className="space-y-4 border-t pt-4">
        <h2 className="text-xl font-semibold">Invite Member</h2>
        <Input
          type="email"
          value={email}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
          placeholder="Email address"
        />
        <select
          value={inviteRole}
          onChange={(e) => setInviteRole(e.target.value)}
          className="border rounded px-2 py-1"
        >
          {ROLE_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <Button type="submit" disabled={inviteLoading || !email.trim()}>
          {inviteLoading ? 'Inviting…' : 'Invite'}
        </Button>
      </form>
    </div>
  );
};

export default TenantMembers;