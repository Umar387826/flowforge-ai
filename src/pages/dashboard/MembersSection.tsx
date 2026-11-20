import React, { useEffect, useState } from 'react';
import { Building2, Trash2, UserPlus } from 'lucide-react';
import { api, FlowForgeApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import type { OrganizationInvitation, OrganizationMember, OrgRole } from '../../types/api';
import { ConfirmDialog, ErrorBanner, LoadingSkeleton, SuccessBanner } from '../../components/ui/StateViews';
import { StatusText } from '../../components/ui/StatusText';
import { formatDatePK } from '../../utils/format';

export const MembersSection: React.FC = () => {
  const { activeOrg, refreshSession, switchOrganization } = useAuth();
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<OrgRole>('member');
  const [newOrgName, setNewOrgName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [removeTarget, setRemoveTarget] = useState<OrganizationMember | null>(null);

  const loadMembers = async () => {
    setLoading(true);
    try {
      const [mRes, iRes] = await Promise.all([api.listMemberships(), api.listInvitations()]);
      setMembers(mRes.results);
      setInvitations(iRes.results);
    } catch (err) {
      setError(err instanceof FlowForgeApiError ? err.message : 'Failed to load members.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeOrg) loadMembers();
  }, [activeOrg?.id]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.includes('@')) return;
    try {
      await api.sendInvitation({ email: inviteEmail.trim(), role: inviteRole });
      setInviteEmail('');
      setNotice(`Invitation sent to ${inviteEmail.trim()}.`);
      loadMembers();
    } catch (err) {
      setError(err instanceof FlowForgeApiError ? err.message : 'Failed to send invitation.');
    }
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) return;
    try {
      const org = await api.createOrganization({ name: newOrgName.trim() });
      setNewOrgName('');
      await refreshSession();
      await switchOrganization(org.id);
      setNotice(`Created and switched to "${org.name}".`);
    } catch (err) {
      setError(err instanceof FlowForgeApiError ? err.message : 'Failed to create organization.');
    }
  };

  const handleRemove = async () => {
    if (!removeTarget) return;
    try {
      await api.removeMember(removeTarget.id);
      setRemoveTarget(null);
      loadMembers();
    } catch (err) {
      setError(err instanceof FlowForgeApiError ? err.message : 'Failed to remove member.');
    }
  };

  if (loading) return <LoadingSkeleton rows={4} />;

  return (
    <div className="space-y-6">
      <div className="ff-page-header">
        <div>
          <h1 className="ff-page-title">Organization &amp; Members</h1>
          <p className="ff-page-subtitle">
            Manage role-based access control (Owner, Admin, Manager, Member) and tenant invitations.
          </p>
        </div>
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}
      {notice && <SuccessBanner message={notice} onDismiss={() => setNotice('')} />}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <form onSubmit={handleInvite} className="ff-card-padded space-y-3">
          <h2 className="font-display text-sm font-semibold text-[var(--ff-text-primary)]">Invite Team Member</h2>
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <input
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colleague@company.pk"
              className="ff-input flex-1"
            />
            <select
              aria-label="Invitation role"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as OrgRole)}
              className="ff-select sm:w-32"
            >
              <option value="member">Member</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
              <option value="owner">Owner</option>
            </select>
            <button type="submit" className="ff-btn ff-btn-primary">
              <UserPlus className="h-4 w-4" />
              <span>Invite</span>
            </button>
          </div>
        </form>

        <form onSubmit={handleCreateOrg} className="ff-card-padded space-y-3">
          <h2 className="font-display text-sm font-semibold text-[var(--ff-text-primary)]">Create New Organization</h2>
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <input
              type="text"
              required
              value={newOrgName}
              onChange={(e) => setNewOrgName(e.target.value)}
              placeholder="New Tenant Organization Name"
              className="ff-input flex-1"
            />
            <button type="submit" className="ff-btn ff-btn-teal">
              <Building2 className="h-4 w-4" />
              <span>Create Org</span>
            </button>
          </div>
        </form>
      </div>

      <div className="ff-table-wrap">
        <table className="ff-table">
          <thead>
            <tr>
              <th>Member</th>
              <th>Role</th>
              <th>Joined</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id}>
                <td>
                  <div className="font-semibold text-[var(--ff-text-primary)]">{m.user.full_name}</div>
                  <div className="text-xs text-[var(--ff-text-muted)]">{m.user.email}</div>
                </td>
                <td>
                  <select
                    aria-label={`Role for ${m.user.email}`}
                    value={m.role}
                    onChange={async (e) => {
                      try {
                        await api.updateMemberRole(m.id, e.target.value);
                        loadMembers();
                      } catch (err) {
                        setError(err instanceof FlowForgeApiError ? err.message : 'Role update failed.');
                      }
                    }}
                    className="ff-select w-32 py-1 text-xs capitalize"
                  >
                    <option value="owner">Owner</option>
                    <option value="admin">Admin</option>
                    <option value="manager">Manager</option>
                    <option value="member">Member</option>
                  </select>
                </td>
                <td className="font-mono text-xs tabular-nums text-[var(--ff-text-muted)]">
                  {formatDatePK(m.created_at)}
                </td>
                <td className="text-right">
                  <button
                    type="button"
                    onClick={() => setRemoveTarget(m)}
                    aria-label={`Remove ${m.user.email}`}
                    className="ff-btn ff-btn-danger-outline ff-btn-sm px-2"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {invitations.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-display text-sm font-semibold text-[var(--ff-text-primary)]">
            Pending &amp; Past Invitations
          </h2>
          <div className="ff-table-wrap">
            <table className="ff-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {invitations.map((inv) => (
                  <tr key={inv.id}>
                    <td className="font-medium text-[var(--ff-text-primary)]">{inv.email}</td>
                    <td className="capitalize text-xs text-[var(--ff-text-secondary)]">{inv.role}</td>
                    <td>
                      <StatusText status={inv.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(removeTarget)}
        title="Remove Organization Member"
        description={`Remove ${removeTarget?.user.email} from ${activeOrg?.name}?`}
        confirmLabel="Remove"
        onConfirm={handleRemove}
        onCancel={() => setRemoveTarget(null)}
      />
    </div>
  );
};
