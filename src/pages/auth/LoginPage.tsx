import React, { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Lock, ShieldCheck, Sparkles, Workflow } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { FlowForgeApiError } from '../../api/client';
import { ErrorBanner } from '../../components/ui/StateViews';

export const LoginPage: React.FC = () => {
  const { login, loginWithGoogle, backendReachable } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.includes('@')) {
      setError('Enter a valid work email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof FlowForgeApiError ? err.message : 'Sign-in failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-screen grid-cols-1 bg-[var(--ff-bg-canvas)] lg:grid-cols-12">
      <section className="hidden flex-col justify-between bg-[var(--ff-bg-navy)] p-10 text-[var(--ff-text-on-navy)] lg:col-span-5 lg:flex xl:p-14">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--ff-royal)] text-sm font-bold text-white">
              FF
            </div>
            <div>
              <span className="font-display text-lg font-bold tracking-tight text-white">FlowForge AI</span>
              <span className="ml-2 rounded border border-[var(--ff-border-navy)] bg-[var(--ff-bg-navy-elevated)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--ff-teal-text)]">
                ENTERPRISE
              </span>
            </div>
          </div>

          <h2 className="mt-12 font-display text-3xl leading-tight font-bold tracking-tight text-white">
            Enterprise AI agents &amp; workflow automation built for Pakistani businesses.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-[var(--ff-text-on-navy-muted)]">
            Deploy verified RAG assistants for real estate groups, healthcare networks, and B2B sales teams across
            Karachi, Lahore, and Islamabad with strict multi-tenant PostgreSQL isolation.
          </p>

          <dl className="mt-10 space-y-5 border-t border-[var(--ff-border-navy)] pt-8">
            <div className="flex items-start gap-3.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--ff-bg-navy-elevated)] text-[var(--ff-teal)]">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <dt className="text-sm font-semibold text-white">Cryptographic Row-Level Security</dt>
                <dd className="mt-0.5 text-xs text-[var(--ff-text-on-navy-muted)]">
                  Every query, vector embedding, and CRM lead is isolated per organization via HMAC-signed PostgreSQL RLS.
                </dd>
              </div>
            </div>
            <div className="flex items-start gap-3.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--ff-bg-navy-elevated)] text-[var(--ff-royal-text)]">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <dt className="text-sm font-semibold text-white">Grounded Document Intelligence</dt>
                <dd className="mt-0.5 text-xs text-[var(--ff-text-on-navy-muted)]">
                  Index project brochures, pricing sheets, and SOPs into pgvector with source-cited streaming responses.
                </dd>
              </div>
            </div>
            <div className="flex items-start gap-3.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--ff-bg-navy-elevated)] text-[var(--ff-teal)]">
                <Workflow className="h-4 w-4" />
              </div>
              <div>
                <dt className="text-sm font-semibold text-white">Automated Lead Qualification &amp; HubSpot Sync</dt>
                <dd className="mt-0.5 text-xs text-[var(--ff-text-on-navy-muted)]">
                  Score buyer inquiries automatically and dispatch verified contacts to your CRM pipeline in real time.
                </dd>
              </div>
            </div>
          </dl>
        </div>

        <div className="flex items-center justify-between border-t border-[var(--ff-border-navy)] pt-6 text-xs text-[var(--ff-text-on-navy-muted)]">
          <span>FlowForge AI Multi-Tenant Platform</span>
          <span className="inline-flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5" />
            JWT + TLS Ready
          </span>
        </div>
      </section>

      <main className="flex flex-col items-center justify-center px-4 py-10 sm:px-8 lg:col-span-7">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center gap-2.5 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--ff-bg-navy)] text-xs font-bold text-white">
              FF
            </div>
            <span className="font-display text-base font-bold text-[var(--ff-text-primary)]">FlowForge AI</span>
          </div>

          <div className="ff-card p-7 sm:p-9">
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--ff-royal-text)]">
                Workspace Access
              </p>
              <h1 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-[var(--ff-text-primary)]">
                Sign in to your workspace
              </h1>
              <p className="mt-1 text-sm text-[var(--ff-text-muted)]">
                Access your AI agents, knowledge bases, and automation pipelines.
              </p>
            </div>

            {!backendReachable && (
              <div className="mb-5 rounded-[var(--ff-radius-md)] border border-[rgba(217,119,6,0.3)] bg-[var(--ff-warning-soft)] px-3.5 py-2.5 text-xs text-[var(--ff-warning)]">
                Django API backend is not currently reachable at the configured endpoint. Start the backend with{' '}
                <code className="font-mono font-semibold">docker compose up</code> to authenticate.
              </div>
            )}

            {error && (
              <div className="mb-5">
                <ErrorBanner message={error} onDismiss={() => setError('')} />
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label htmlFor="login-email" className="ff-label">
                  Work Email
                </label>
                <input
                  id="login-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="amina.khan@indusrealty.pk"
                  className="ff-input"
                />
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label htmlFor="login-password" className="ff-label mb-0">
                    Password
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-xs font-medium text-[var(--ff-royal-text)] hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <input
                  id="login-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="ff-input"
                />
              </div>

              <button type="submit" disabled={submitting} className="ff-btn ff-btn-primary mt-2 w-full">
                <span>{submitting ? 'Signing in...' : 'Sign In'}</span>
                {!submitting && <ArrowRight className="h-4 w-4" />}
              </button>
            </form>

            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-[var(--ff-border)]" />
              <span className="text-xs text-[var(--ff-text-muted)]">OR CONTINUE WITH</span>
              <div className="h-px flex-1 bg-[var(--ff-border)]" />
            </div>

            {import.meta.env.VITE_GOOGLE_CLIENT_ID ? (
              <div className="flex justify-center">
                <GoogleLogin
                  onSuccess={async (response) => {
                    if (!response.credential) {
                      setError('Google did not return a valid credential.');
                      return;
                    }
                    setError('');
                    setSubmitting(true);
                    try {
                      await loginWithGoogle(response.credential);
                      navigate('/dashboard');
                    } catch (err) {
                      setError(err instanceof FlowForgeApiError ? err.message : 'Google sign-in failed.');
                    } finally {
                      setSubmitting(false);
                    }
                  }}
                  onError={() => setError('Google sign-in could not be completed. Please try again.')}
                  text="continue_with"
                  shape="rectangular"
                  width="320"
                />
              </div>
            ) : (
              <p className="text-center text-xs text-[var(--ff-text-muted)]">
                Google Login requires VITE_GOOGLE_CLIENT_ID configuration.
              </p>
            )}

            <p className="mt-6 border-t border-[var(--ff-border)] pt-5 text-center text-sm text-[var(--ff-text-secondary)]">
              New organization?{' '}
              <Link to="/register" className="font-semibold text-[var(--ff-royal-text)] hover:underline">
                Create an account
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};
