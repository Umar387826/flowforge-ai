import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Building2, CheckCircle2, Loader2 } from 'lucide-react';
import { api, FlowForgeApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { ErrorBanner } from '../../components/ui/StateViews';

export const AcceptInvitePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading, refreshSession, switchOrganization } = useAuth();
  const [status, setStatus] = useState<'idle' | 'processing' | 'accepted' | 'error'>('idle');
  const [error, setError] = useState('');

  const token = searchParams.get('token') || '';

  useEffect(() => {
    if (loading || !user) return;
    if (!token) {
      setStatus('error');
      setError('Missing organization invitation token.');
      return;
    }

    let cancelled = false;
    setStatus('processing');
    api
      .acceptInvitation(token)
      .then(async (res) => {
        if (cancelled) return;
        await refreshSession();
        await switchOrganization(res.organization_id);
        setStatus('accepted');
        window.setTimeout(() => {
          navigate('/dashboard', { replace: true });
        }, 900);
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus('error');
        setError(err instanceof FlowForgeApiError ? err.message : 'Unable to accept invitation.');
      });

    return () => {
      cancelled = true;
    };
  }, [loading, user?.id, token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--ff-bg-canvas)] px-4 py-12">
      <div className="ff-card w-full max-w-md p-7 text-center">
        <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--ff-royal-soft)] text-[var(--ff-royal-text)]">
          {status === 'processing' || loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : status === 'accepted' ? (
            <CheckCircle2 className="h-5 w-5 text-[var(--ff-teal)]" />
          ) : (
            <Building2 className="h-5 w-5" />
          )}
        </div>

        <h1 className="font-display text-lg font-bold text-[var(--ff-text-primary)]">Workspace Invitation</h1>

        {!loading && !user ? (
          <>
            <p className="mt-2 text-xs text-[var(--ff-text-muted)]">
              Sign in or register with the invited email address to join this organization.
            </p>
            <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
              <Link to="/login" className="ff-btn ff-btn-primary flex-1">
                Sign In
              </Link>
              <Link to="/register" className="ff-btn ff-btn-secondary flex-1">
                Create Account
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className="mt-1.5 text-xs text-[var(--ff-text-muted)]">
              {status === 'processing' && 'Validating invitation and activating workspace membership...'}
              {status === 'accepted' && 'Membership activated. Redirecting to your workspace dashboard...'}
              {status === 'error' && 'Invitation acceptance failed.'}
            </p>
            {error && (
              <div className="mt-4 text-left">
                <ErrorBanner message={error} />
              </div>
            )}
            <div className="mt-6">
              <Link to="/dashboard" className="ff-btn ff-btn-secondary w-full">
                Go to Dashboard
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
