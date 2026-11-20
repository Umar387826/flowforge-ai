import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Building2, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { FlowForgeApiError } from '../../api/client';
import { ErrorBanner } from '../../components/ui/StateViews';

export const RegisterPage: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!fullName.trim()) {
      setError('Full name is required.');
      return;
    }
    if (!email.includes('@')) {
      setError('Enter a valid email address.');
      return;
    }
    if (!organizationName.trim()) {
      setError('Organization name is required.');
      return;
    }
    if (password.length < 10) {
      setError('Password must be at least 10 characters.');
      return;
    }

    setSubmitting(true);
    try {
      await register({
        email: email.trim(),
        full_name: fullName.trim(),
        password,
        organization_name: organizationName.trim(),
      });
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof FlowForgeApiError ? err.message : 'Registration failed.');
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
            <span className="font-display text-lg font-bold tracking-tight text-white">FlowForge AI</span>
          </div>

          <h2 className="mt-12 font-display text-3xl leading-tight font-bold tracking-tight text-white">
            Provision an isolated multi-tenant AI workspace in seconds.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-[var(--ff-text-on-navy-muted)]">
            Built for commercial teams in Pakistan and global markets needing reliable customer chatbots, verified PDF
            knowledge bases, and automated HubSpot CRM lead routing.
          </p>

          <ul className="mt-10 space-y-4 border-t border-[var(--ff-border-navy)] pt-8 text-sm">
            {[
              'Dedicated PostgreSQL Row-Level Security tenant partition',
              'Anthropic Claude & OpenAI vector embeddings via pgvector',
              'Real-time WebSocket streaming & embeddable customer widget',
              'Role-based access control for Owner, Admin, Manager & Member',
            ].map((point) => (
              <li key={point} className="flex items-start gap-3 text-[var(--ff-text-on-navy)]">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ff-teal)]" />
                <span className="text-xs leading-relaxed text-[var(--ff-text-on-navy-muted)]">{point}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-[var(--ff-border-navy)] bg-[var(--ff-bg-navy-elevated)] p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-white">
            <Building2 className="h-4 w-4 text-[var(--ff-teal)]" />
            <span>Starter Workspace Included</span>
          </div>
          <p className="mt-1 text-xs text-[var(--ff-text-on-navy-muted)]">
            Start immediately on the Free tier with 2 AI agents, 50 documents, and 250 workflow runs per month.
          </p>
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
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--ff-teal-text)]">
                Organization Onboarding
              </p>
              <h1 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-[var(--ff-text-primary)]">
                Create your organization
              </h1>
              <p className="mt-1 text-sm text-[var(--ff-text-muted)]">
                Provision an isolated multi-tenant workspace with RAG agents and automation workflows.
              </p>
            </div>

            {error && (
              <div className="mb-5">
                <ErrorBanner message={error} onDismiss={() => setError('')} />
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label htmlFor="reg-name" className="ff-label">
                  Full Name
                </label>
                <input
                  id="reg-name"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Bilal Ahmed"
                  className="ff-input"
                />
              </div>

              <div>
                <label htmlFor="reg-org" className="ff-label">
                  Company / Organization Name
                </label>
                <input
                  id="reg-org"
                  type="text"
                  required
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  placeholder="Indus Horizon Properties (Pvt) Ltd"
                  className="ff-input"
                />
              </div>

              <div>
                <label htmlFor="reg-email" className="ff-label">
                  Work Email
                </label>
                <input
                  id="reg-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="bilal@indushorizon.pk"
                  className="ff-input"
                />
              </div>

              <div>
                <label htmlFor="reg-password" className="ff-label">
                  Password (minimum 10 characters)
                </label>
                <input
                  id="reg-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 10 characters"
                  className="ff-input"
                />
              </div>

              <button type="submit" disabled={submitting} className="ff-btn ff-btn-primary mt-2 w-full">
                <span>{submitting ? 'Provisioning workspace...' : 'Create Workspace'}</span>
                {!submitting && <ArrowRight className="h-4 w-4" />}
              </button>
            </form>

            <p className="mt-6 border-t border-[var(--ff-border)] pt-5 text-center text-sm text-[var(--ff-text-secondary)]">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-[var(--ff-royal-text)] hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};
