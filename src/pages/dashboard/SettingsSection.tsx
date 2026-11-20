import React, { useEffect, useState } from 'react';
import { Building2, ShieldCheck, User } from 'lucide-react';
import { api, FlowForgeApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { ErrorBanner, SuccessBanner } from '../../components/ui/StateViews';

export const SettingsSection: React.FC = () => {
  const { user, activeOrg, refreshSession } = useAuth();
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [orgName, setOrgName] = useState(activeOrg?.name || '');
  const [industry, setIndustry] = useState('');
  const [website, setWebsite] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    setFullName(user?.full_name || '');
    if (activeOrg) {
      api
        .getCurrentOrganization()
        .then((org) => {
          setOrgName(org.name);
          setIndustry(org.industry || '');
          setWebsite(org.website || '');
        })
        .catch(() => {});
    }
  }, [activeOrg?.id, user?.full_name]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api.updateProfile({ full_name: fullName.trim() });
      await refreshSession();
      setNotice('User profile updated.');
    } catch (err) {
      setError(err instanceof FlowForgeApiError ? err.message : 'Profile update failed.');
    }
  };

  const handleSaveOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api.updateCurrentOrganization({
        name: orgName.trim(),
        industry: industry.trim(),
        website: website.trim(),
      });
      await refreshSession();
      setNotice('Organization settings updated.');
    } catch (err) {
      setError(err instanceof FlowForgeApiError ? err.message : 'Organization update failed.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="ff-page-header">
        <div>
          <h1 className="ff-page-title">Settings</h1>
          <p className="ff-page-subtitle">
            Manage your user profile, organization details, and cryptographic tenant isolation summary.
          </p>
        </div>
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}
      {notice && <SuccessBanner message={notice} onDismiss={() => setNotice('')} />}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <form onSubmit={handleSaveProfile} className="ff-card-padded space-y-4">
          <div className="flex items-center gap-2.5 border-b border-[var(--ff-border)] pb-3">
            <User className="h-4 w-4 text-[var(--ff-royal-text)]" />
            <h2 className="font-display text-base font-semibold text-[var(--ff-text-primary)]">User Profile</h2>
          </div>

          <div>
            <label htmlFor="settings-email" className="ff-label">
              Email
            </label>
            <input id="settings-email" type="email" disabled value={user?.email || ''} className="ff-input" />
          </div>
          <div>
            <label htmlFor="settings-fullname" className="ff-label">
              Full Name
            </label>
            <input
              id="settings-fullname"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="ff-input"
            />
          </div>
          <div className="pt-1">
            <button type="submit" className="ff-btn ff-btn-primary">
              Save Profile
            </button>
          </div>
        </form>

        <form onSubmit={handleSaveOrg} className="ff-card-padded space-y-4">
          <div className="flex items-center gap-2.5 border-b border-[var(--ff-border)] pb-3">
            <Building2 className="h-4 w-4 text-[var(--ff-teal)]" />
            <h2 className="font-display text-base font-semibold text-[var(--ff-text-primary)]">
              Organization Settings
            </h2>
          </div>

          <div>
            <label htmlFor="settings-org-name" className="ff-label">
              Organization Name
            </label>
            <input
              id="settings-org-name"
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className="ff-input"
            />
          </div>
          <div>
            <label htmlFor="settings-industry" className="ff-label">
              Industry
            </label>
            <input
              id="settings-industry"
              type="text"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="Real Estate & Development"
              className="ff-input"
            />
          </div>
          <div>
            <label htmlFor="settings-website" className="ff-label">
              Website
            </label>
            <input
              id="settings-website"
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://indushorizon.pk"
              className="ff-input"
            />
          </div>
          <div className="pt-1">
            <button type="submit" className="ff-btn ff-btn-primary">
              Save Organization
            </button>
          </div>
        </form>
      </div>

      <div className="ff-card-padded">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="h-4 w-4 text-[var(--ff-teal)]" />
          <h2 className="font-display text-base font-semibold text-[var(--ff-text-primary)]">
            Tenant Security Context
          </h2>
        </div>
        <dl className="mt-4 grid grid-cols-1 gap-4 rounded-lg border border-[var(--ff-border)] bg-[var(--ff-bg-subtle)] p-4 text-xs sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="font-medium text-[var(--ff-text-muted)]">Organization ID</dt>
            <dd className="mt-1 truncate font-mono text-[var(--ff-text-primary)]">{activeOrg?.id}</dd>
          </div>
          <div>
            <dt className="font-medium text-[var(--ff-text-muted)]">Your Role</dt>
            <dd className="mt-1 font-semibold capitalize text-[var(--ff-text-primary)]">{activeOrg?.role}</dd>
          </div>
          <div>
            <dt className="font-medium text-[var(--ff-text-muted)]">Regional Defaults</dt>
            <dd className="mt-1 font-mono font-medium text-[var(--ff-text-primary)]">
              {(activeOrg?.settings?.currency as string) || 'PKR'} · {(activeOrg?.settings?.timezone as string) || 'Asia/Karachi'} · {(activeOrg?.settings?.date_format as string) || 'DD-MM-YYYY'}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-[var(--ff-text-muted)]">Database Isolation</dt>
            <dd className="mt-1 font-medium text-[var(--ff-teal-text)]">
              PostgreSQL FORCE RLS + HMAC-SHA256 SET LOCAL
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
};
