import React, { useEffect, useState } from 'react';
import { ArrowUpRight, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { api, FlowForgeApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import type { Lead } from '../../types/api';
import { ConfirmDialog, EmptyState, ErrorBanner, LoadingSkeleton, SuccessBanner } from '../../components/ui/StateViews';
import { StatusText } from '../../components/ui/StatusText';

export const LeadsSection: React.FC = () => {
  const { activeOrg } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Lead | null>(null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [budget, setBudget] = useState('');

  const loadLeads = async (statusFilter = filter) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.listLeads(statusFilter);
      setLeads(res.results);
    } catch (err) {
      setError(err instanceof FlowForgeApiError ? err.message : 'Failed to load leads.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeOrg) loadLeads(filter);
  }, [activeOrg?.id, filter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes('@')) {
      setError('Valid lead email is required.');
      return;
    }
    try {
      await api.createLead({
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        preferences: budget ? { budget } : {},
      });
      setFullName('');
      setEmail('');
      setPhone('');
      setBudget('');
      setShowForm(false);
      setNotice('Lead created and matching workflows dispatched.');
      loadLeads();
    } catch (err) {
      setError(err instanceof FlowForgeApiError ? err.message : 'Failed to create lead.');
    }
  };

  const handleQualify = async (lead: Lead) => {
    setError('');
    try {
      await api.qualifyLead(lead.id);
      setNotice(`AI qualified ${lead.email}.`);
      loadLeads();
    } catch (err) {
      setError(err instanceof FlowForgeApiError ? err.message : 'AI qualification failed.');
    }
  };

  const handleSyncHubspot = async (lead: Lead) => {
    setError('');
    try {
      const res = await api.syncLeadHubspot(lead.id);
      setNotice(`Synced ${lead.email} to HubSpot Contact ID ${res.hubspot.contact_id}.`);
      loadLeads();
    } catch (err) {
      setError(err instanceof FlowForgeApiError ? err.message : 'HubSpot sync failed.');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.deleteLead(deleteTarget.id);
      setDeleteTarget(null);
      loadLeads();
    } catch (err) {
      setError(err instanceof FlowForgeApiError ? err.message : 'Failed to delete lead.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="ff-page-header">
        <div>
          <h1 className="ff-page-title">Leads &amp; CRM</h1>
          <p className="ff-page-subtitle">
            Captured contacts, AI qualification scoring, and real-time HubSpot CRM synchronization.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="ff-segmented" role="tablist" aria-label="Filter leads by status">
            {['', 'new', 'qualified', 'synced'].map((st) => (
              <button
                key={st || 'all'}
                type="button"
                role="tab"
                aria-selected={filter === st}
                onClick={() => setFilter(st)}
                className={`ff-segmented-btn capitalize ${filter === st ? 'ff-segmented-btn-active' : ''}`}
              >
                {st || 'All'}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setShowForm((s) => !s)} className="ff-btn ff-btn-primary">
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            <span>{showForm ? 'Close' : 'Add Lead'}</span>
          </button>
        </div>
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}
      {notice && <SuccessBanner message={notice} onDismiss={() => setNotice('')} />}

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="ff-card-padded grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end"
        >
          <div>
            <label htmlFor="lead-name" className="ff-label">
              Full Name
            </label>
            <input
              id="lead-name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Saad Mahmood"
              className="ff-input"
            />
          </div>
          <div>
            <label htmlFor="lead-email" className="ff-label">
              Email
            </label>
            <input
              id="lead-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="saad@company.pk"
              className="ff-input"
            />
          </div>
          <div>
            <label htmlFor="lead-phone" className="ff-label">
              Phone
            </label>
            <input
              id="lead-phone"
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+92 300 1234567"
              className="ff-input"
            />
          </div>
          <div>
            <label htmlFor="lead-budget" className="ff-label">
              Budget / Preference
            </label>
            <input
              id="lead-budget"
              type="text"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="PKR 4.5 Crore / DHA Phase 6"
              className="ff-input"
            />
          </div>
          <button type="submit" className="ff-btn ff-btn-primary w-full">
            Save Lead
          </button>
        </form>
      )}

      {loading ? (
        <LoadingSkeleton rows={4} />
      ) : leads.length === 0 ? (
        <EmptyState
          title="No leads captured"
          description="Leads captured automatically by AI chatbots or added manually will appear here."
          actionLabel="Add Lead"
          onAction={() => setShowForm(true)}
        />
      ) : (
        <div className="ff-table-wrap">
          <table className="ff-table">
            <thead>
              <tr>
                <th>Lead</th>
                <th>Qualification Score</th>
                <th>Status</th>
                <th>CRM ID</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id}>
                  <td>
                    <div className="font-semibold text-[var(--ff-text-primary)]">{lead.full_name || lead.email}</div>
                    <div className="text-xs text-[var(--ff-text-muted)]">
                      {lead.email} {lead.phone ? `· ${lead.phone}` : ''}
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="ff-progress-track w-20">
                        <div
                          className="ff-progress-fill"
                          style={{
                            width: `${Math.min(100, lead.qualification_score)}%`,
                            backgroundColor: lead.qualification_score >= 60 ? 'var(--ff-teal)' : 'var(--ff-royal)',
                          }}
                        />
                      </div>
                      <span className="font-mono text-xs tabular-nums text-[var(--ff-text-primary)]">
                        {lead.qualification_score}/100
                      </span>
                    </div>
                  </td>
                  <td>
                    <StatusText status={lead.status} />
                  </td>
                  <td className="font-mono text-xs text-[var(--ff-text-muted)]">{lead.crm_external_id || '—'}</td>
                  <td className="text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleQualify(lead)}
                        className="ff-btn ff-btn-secondary ff-btn-sm"
                      >
                        <Sparkles className="h-3.5 w-3.5 text-[var(--ff-teal)]" />
                        <span>Qualify</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSyncHubspot(lead)}
                        className="ff-btn ff-btn-secondary ff-btn-sm"
                      >
                        <ArrowUpRight className="h-3.5 w-3.5 text-[var(--ff-royal-text)]" />
                        <span>HubSpot</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(lead)}
                        aria-label={`Delete ${lead.email}`}
                        className="ff-btn ff-btn-danger-outline ff-btn-sm px-2"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Lead"
        description={`Remove lead "${deleteTarget?.email}" from this organization?`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
