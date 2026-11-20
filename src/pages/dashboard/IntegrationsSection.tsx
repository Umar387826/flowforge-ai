import React, { useEffect, useState } from 'react';
import { Link2, Plug, Trash2, Unlink, Webhook } from 'lucide-react';
import { api, FlowForgeApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import type { IntegrationConnection, SyncLog, WebhookEndpoint } from '../../types/api';
import { ErrorBanner, LoadingSkeleton, SuccessBanner } from '../../components/ui/StateViews';
import { StatusText } from '../../components/ui/StatusText';

export const IntegrationsSection: React.FC = () => {
  const { activeOrg } = useAuth();
  const [connections, setConnections] = useState<IntegrationConnection[]>([]);
  const [credStatus, setCredStatus] = useState({
    google_oauth: false,
    hubspot_oauth: false,
    hubspot_private_token: false,
  });
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([]);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [hsPrivateToken, setHsPrivateToken] = useState('');
  const [hookName, setHookName] = useState('');
  const [hookDirection, setHookDirection] = useState<'inbound' | 'outbound'>('inbound');
  const [hookUrl, setHookUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadAll = async () => {
    setLoading(true);
    try {
      const [intRes, whRes, logRes] = await Promise.all([
        api.listIntegrations(),
        api.listWebhooks(),
        api.listSyncLogs(),
      ]);
      setConnections(intRes.connections);
      setCredStatus(intRes.credentials_status);
      setWebhooks(whRes.results);
      setSyncLogs(logRes.results);
    } catch (err) {
      setError(err instanceof FlowForgeApiError ? err.message : 'Failed to load integrations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeOrg) loadAll();
  }, [activeOrg?.id]);

  const handleOAuthConnect = async (provider: 'google_oauth' | 'hubspot') => {
    setError('');
    try {
      const res = await api.connectIntegration(provider);
      if (res.authorize_url) {
        window.location.href = res.authorize_url;
      }
    } catch (err) {
      setError(err instanceof FlowForgeApiError ? err.message : 'Connection failed.');
    }
  };

  const handleHubspotTokenSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hsPrivateToken.trim()) return;
    try {
      await api.connectIntegration('hubspot', { private_token: hsPrivateToken.trim() });
      setHsPrivateToken('');
      setNotice('HubSpot private app token stored for this organization.');
      loadAll();
    } catch (err) {
      setError(err instanceof FlowForgeApiError ? err.message : 'Failed to save HubSpot token.');
    }
  };

  const handleCreateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hookName.trim()) return;
    try {
      await api.createWebhook({ name: hookName.trim(), direction: hookDirection, url: hookUrl.trim() });
      setHookName('');
      setHookUrl('');
      setNotice('Signed webhook endpoint created.');
      loadAll();
    } catch (err) {
      setError(err instanceof FlowForgeApiError ? err.message : 'Failed to create webhook.');
    }
  };

  if (loading) return <LoadingSkeleton rows={4} />;

  const googleConn = connections.find((c) => c.provider === 'google_oauth');
  const hubspotConn = connections.find((c) => c.provider === 'hubspot');

  return (
    <div className="space-y-6">
      <div className="ff-page-header">
        <div>
          <h1 className="ff-page-title">Integrations &amp; Webhooks</h1>
          <p className="ff-page-subtitle">
            Connect Google OAuth 2.0, HubSpot CRM, and HMAC-signed inbound/outbound webhooks.
          </p>
        </div>
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}
      {notice && <SuccessBanner message={notice} onDismiss={() => setNotice('')} />}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="ff-card-padded flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--ff-royal-soft)] text-[var(--ff-royal-text)]">
                  <Plug className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="font-display text-base font-semibold text-[var(--ff-text-primary)]">
                    Google OAuth 2.0
                  </h2>
                  <p className="mt-0.5 text-xs text-[var(--ff-text-muted)]">
                    {credStatus.google_oauth
                      ? 'Server OAuth client configured.'
                      : 'Awaiting GOOGLE_OAUTH_CLIENT_ID / SECRET in environment.'}
                  </p>
                </div>
              </div>
              <StatusText status={googleConn?.status || 'disconnected'} />
            </div>
            {googleConn?.account_email && (
              <p className="mt-3 rounded-md border border-[var(--ff-border)] bg-[var(--ff-bg-subtle)] px-3 py-1.5 font-mono text-xs text-[var(--ff-text-secondary)]">
                {googleConn.account_email}
              </p>
            )}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" onClick={() => handleOAuthConnect('google_oauth')} className="ff-btn ff-btn-primary ff-btn-sm">
              <Link2 className="h-3.5 w-3.5" />
              <span>Connect Google</span>
            </button>
            {googleConn?.status === 'connected' && (
              <button
                type="button"
                onClick={async () => {
                  await api.disconnectIntegration(googleConn.id);
                  loadAll();
                }}
                className="ff-btn ff-btn-secondary ff-btn-sm"
              >
                <Unlink className="h-3.5 w-3.5" />
                <span>Disconnect</span>
              </button>
            )}
          </div>
        </div>

        <div className="ff-card-padded flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--ff-teal-soft)] text-[var(--ff-teal-text)]">
                  <Plug className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="font-display text-base font-semibold text-[var(--ff-text-primary)]">HubSpot CRM</h2>
                  <p className="mt-0.5 text-xs text-[var(--ff-text-muted)]">
                    {credStatus.hubspot_oauth || credStatus.hubspot_private_token
                      ? 'HubSpot credentials detected.'
                      : 'Connect via OAuth or enter an organization HubSpot Private App token.'}
                  </p>
                </div>
              </div>
              <StatusText status={hubspotConn?.status || 'disconnected'} />
            </div>

            <form onSubmit={handleHubspotTokenSave} className="mt-4 flex flex-col gap-2 sm:flex-row">
              <input
                type="password"
                value={hsPrivateToken}
                onChange={(e) => setHsPrivateToken(e.target.value)}
                placeholder="pat-na1-..."
                className="ff-input flex-1 font-mono text-xs"
              />
              <button type="submit" className="ff-btn ff-btn-teal ff-btn-sm">
                Save Token
              </button>
            </form>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => handleOAuthConnect('hubspot')} className="ff-btn ff-btn-secondary ff-btn-sm">
              <Link2 className="h-3.5 w-3.5" />
              <span>HubSpot OAuth</span>
            </button>
          </div>
        </div>
      </div>

      <div className="ff-card-padded space-y-4">
        <div className="flex items-center gap-2">
          <Webhook className="h-4 w-4 text-[var(--ff-royal-text)]" />
          <h2 className="font-display text-base font-semibold text-[var(--ff-text-primary)]">Signed Webhooks</h2>
        </div>

        <form onSubmit={handleCreateWebhook} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input
            type="text"
            value={hookName}
            onChange={(e) => setHookName(e.target.value)}
            placeholder="Endpoint name"
            className="ff-input"
          />
          <select
            value={hookDirection}
            onChange={(e) => setHookDirection(e.target.value as 'inbound' | 'outbound')}
            className="ff-select"
          >
            <option value="inbound">Inbound</option>
            <option value="outbound">Outbound</option>
          </select>
          <input
            type="url"
            value={hookUrl}
            onChange={(e) => setHookUrl(e.target.value)}
            placeholder="https://example.com/hook (outbound)"
            className="ff-input"
          />
          <button type="submit" className="ff-btn ff-btn-primary w-full">
            Create Webhook
          </button>
        </form>

        {webhooks.length > 0 && (
          <div className="ff-table-wrap">
            <table className="ff-table">
              <thead>
                <tr>
                  <th>Endpoint</th>
                  <th>Direction</th>
                  <th>HMAC Signing Secret</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {webhooks.map((wh) => (
                  <tr key={wh.id}>
                    <td className="font-semibold text-[var(--ff-text-primary)]">{wh.name}</td>
                    <td className="capitalize text-xs text-[var(--ff-text-secondary)]">{wh.direction}</td>
                    <td className="font-mono text-xs text-[var(--ff-text-muted)]">{wh.signing_secret}</td>
                    <td className="text-right">
                      <button
                        type="button"
                        onClick={async () => {
                          await api.deleteWebhook(wh.id);
                          loadAll();
                        }}
                        aria-label={`Delete ${wh.name}`}
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
        )}
      </div>

      {syncLogs.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-display text-sm font-semibold text-[var(--ff-text-primary)]">CRM Sync History</h2>
          <div className="ff-table-wrap">
            <table className="ff-table">
              <thead>
                <tr>
                  <th>Provider</th>
                  <th>Resource</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {syncLogs.slice(0, 8).map((log) => (
                  <tr key={log.id}>
                    <td className="font-medium capitalize text-[var(--ff-text-primary)]">{log.provider}</td>
                    <td className="text-xs text-[var(--ff-text-secondary)]">
                      {log.resource_type} ({log.external_id || log.resource_id})
                      {log.error_message && <p className="mt-0.5 text-[var(--ff-danger)]">{log.error_message}</p>}
                    </td>
                    <td>
                      <StatusText status={log.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
