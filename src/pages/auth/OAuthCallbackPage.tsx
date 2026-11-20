import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { api, FlowForgeApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { ErrorBanner } from '../../components/ui/StateViews';

export const OAuthCallbackPage: React.FC<{ provider: 'google_oauth' | 'hubspot' }> = ({ provider }) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { activeOrg } = useAuth();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [error, setError] = useState('');

  useEffect(() => {
    const code = searchParams.get('code') || '';
    const state = searchParams.get('state') || '';
    const oauthErr = searchParams.get('error');

    if (oauthErr) {
      setStatus('error');
      setError(`OAuth authorization declined or failed: ${oauthErr}`);
      return;
    }

    if (!code || !state) {
      setStatus('error');
      setError('Missing OAuth authorization code or signed state parameter.');
      return;
    }

    if (!activeOrg) {
      return;
    }

    let cancelled = false;
    api
      .completeIntegrationCallback(provider, code, state)
      .then(() => {
        if (cancelled) return;
        setStatus('success');
        window.setTimeout(() => {
          navigate('/dashboard?section=integrations', { replace: true });
        }, 1000);
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus('error');
        setError(err instanceof FlowForgeApiError ? err.message : 'OAuth token exchange failed.');
      });

    return () => {
      cancelled = true;
    };
  }, [provider, searchParams, activeOrg?.id, navigate]);

  const providerLabel = provider === 'google_oauth' ? 'Google Workspace' : 'HubSpot CRM';

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--ff-bg-canvas)] px-4 py-12">
      <div className="ff-card w-full max-w-md p-7 text-center">
        <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--ff-royal-soft)] text-[var(--ff-royal-text)]">
          {status === 'processing' ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <CheckCircle2 className="h-5 w-5 text-[var(--ff-teal)]" />
          )}
        </div>
        <h1 className="font-display text-lg font-bold text-[var(--ff-text-primary)]">
          Connecting {providerLabel}
        </h1>
        <p className="mt-1.5 text-xs text-[var(--ff-text-muted)]">
          {status === 'processing' && 'Completing server-side OAuth token exchange for your active workspace...'}
          {status === 'success' && `${providerLabel} connected successfully. Redirecting back to Integrations...`}
          {status === 'error' && 'Unable to complete OAuth connection.'}
        </p>

        {error && (
          <div className="mt-4 text-left">
            <ErrorBanner message={error} />
          </div>
        )}

        <div className="mt-6">
          <Link to="/dashboard?section=integrations" className="ff-btn ff-btn-secondary w-full">
            Return to Integrations
          </Link>
        </div>
      </div>
    </div>
  );
};
