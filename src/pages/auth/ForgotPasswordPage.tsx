import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, KeyRound } from 'lucide-react';
import { api, FlowForgeApiError } from '../../api/client';
import { ErrorBanner, SuccessBanner } from '../../components/ui/StateViews';

export const ForgotPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialToken = searchParams.get('token') || '';
  const [email, setEmail] = useState('');
  const [token, setToken] = useState(initialToken);
  const [newPassword, setNewPassword] = useState('');
  const [mode, setMode] = useState<'request' | 'confirm'>(initialToken ? 'confirm' : 'request');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const res = await api.requestPasswordReset(email.trim());
      setMessage(res.detail);
      setMode('confirm');
    } catch (err) {
      setError(err instanceof FlowForgeApiError ? err.message : 'Unable to send reset email.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    if (newPassword.length < 10) {
      setError('New password must be at least 10 characters.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.confirmPasswordReset(token.trim(), newPassword);
      setMessage(res.detail);
    } catch (err) {
      setError(err instanceof FlowForgeApiError ? err.message : 'Password reset failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--ff-bg-canvas)] px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--ff-bg-navy)] text-xs font-bold text-white">
            FF
          </div>
          <span className="font-display text-base font-bold text-[var(--ff-text-primary)]">FlowForge AI</span>
        </div>

        <div className="ff-card p-7 sm:p-8">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--ff-royal-soft)] text-[var(--ff-royal-text)]">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold text-[var(--ff-text-primary)]">Reset password</h1>
              <p className="text-xs text-[var(--ff-text-muted)]">
                {mode === 'request'
                  ? 'Receive a time-limited token to restore workspace access.'
                  : 'Enter your verification token and new credentials.'}
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-4">
              <ErrorBanner message={error} onDismiss={() => setError('')} />
            </div>
          )}
          {message && (
            <div className="mb-4">
              <SuccessBanner message={message} />
            </div>
          )}

          {mode === 'request' ? (
            <form onSubmit={handleRequest} className="space-y-4">
              <div>
                <label htmlFor="reset-email" className="ff-label">
                  Account Email
                </label>
                <input
                  id="reset-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="amina.khan@indusrealty.pk"
                  className="ff-input"
                />
              </div>
              <button type="submit" disabled={loading} className="ff-btn ff-btn-primary w-full">
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleConfirm} className="space-y-4">
              <div>
                <label htmlFor="reset-token" className="ff-label">
                  Reset Token
                </label>
                <input
                  id="reset-token"
                  type="text"
                  required
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="ff-input font-mono"
                />
              </div>
              <div>
                <label htmlFor="reset-new-pw" className="ff-label">
                  New Password
                </label>
                <input
                  id="reset-new-pw"
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 10 characters"
                  className="ff-input"
                />
              </div>
              <button type="submit" disabled={loading} className="ff-btn ff-btn-primary w-full">
                {loading ? 'Updating...' : 'Confirm Password Reset'}
              </button>
            </form>
          )}

          <div className="mt-6 flex items-center justify-between border-t border-[var(--ff-border)] pt-4 text-xs">
            <button
              type="button"
              onClick={() => setMode(mode === 'request' ? 'confirm' : 'request')}
              className="font-medium text-[var(--ff-royal-text)] hover:underline"
            >
              {mode === 'request' ? 'Already have a token?' : 'Request a new token'}
            </button>
            <Link
              to="/login"
              className="inline-flex items-center gap-1 font-medium text-[var(--ff-text-secondary)] hover:text-[var(--ff-text-primary)]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to sign in</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
