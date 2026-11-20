import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { setStoredOrgId, setStoredTokens } from '../api/client';
import { DASHBOARD_NAV, DashboardLayout } from '../components/layout/DashboardLayout';
import { AgentsSection } from '../pages/dashboard/AgentsSection';
import { NotificationsSection } from '../pages/dashboard/NotificationsSection';
import { OverviewSection } from '../pages/dashboard/OverviewSection';

describe('Dashboard Layout & Domain Components', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders all 15 dashboard navigation sections and topbar controls', async () => {
    expect(DASHBOARD_NAV).toHaveLength(15);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'ok' }), { status: 200 })),
    );

    render(
      <AuthProvider>
        <MemoryRouter>
          <DashboardLayout activeSection="overview" onSelectSection={() => {}}>
            <div>Content</div>
          </DashboardLayout>
        </MemoryRouter>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Open notifications' })).toBeInTheDocument();
    });

    for (const item of DASHBOARD_NAV) {
      expect(screen.getAllByText(item.label).length).toBeGreaterThan(0);
    }
  });

  it('renders AgentsSection populated list from API', async () => {
    setStoredTokens({ access: 'tok', refresh: 'ref' });
    setStoredOrgId('org-1');

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/auth/me/')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              user: { id: 'u1', email: 'a@b.com', full_name: 'Admin', avatar_url: '', email_verified: true, created_at: '' },
              organizations: [{ id: 'org-1', name: 'Indus Horizon Realty', slug: 'indus-horizon', role: 'owner' }],
            }),
            { status: 200 },
          ),
        );
      }
      if (url.includes('/agents/')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              count: 1,
              next: null,
              previous: null,
              results: [
                {
                  id: 'ag-1',
                  name: 'Property Assistant',
                  description: 'Answers listing questions',
                  system_instructions: 'Be accurate',
                  llm_provider: 'anthropic',
                  model_name: 'claude-3-5-sonnet-20241022',
                  temperature: 0.2,
                  max_tokens: 1024,
                  is_active: true,
                  knowledge_base_ids: ['kb-1'],
                  enabled_tools: ['capture_lead'],
                  widget_config: {},
                  public_embed_key: 'ff_pub_123',
                  created_at: '',
                  updated_at: '',
                },
              ],
            }),
            { status: 200 },
          ),
        );
      }
      return Promise.resolve(new Response(JSON.stringify({ count: 0, results: [] }), { status: 200 }));
    });

    vi.stubGlobal('fetch', fetchMock);

    render(
      <AuthProvider>
        <MemoryRouter>
          <AgentsSection />
        </MemoryRouter>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Property Assistant')).toBeInTheDocument();
    });
  });

  it('renders NotificationsSection items from API', async () => {
    setStoredTokens({ access: 'tok', refresh: 'ref' });
    setStoredOrgId('org-1');

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/auth/me/')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              user: { id: 'u1', email: 'a@b.com', full_name: 'Admin', avatar_url: '', email_verified: true, created_at: '' },
              organizations: [{ id: 'org-1', name: 'Indus Horizon Realty', slug: 'indus-horizon', role: 'owner' }],
            }),
            { status: 200 },
          ),
        );
      }
      if (url.includes('/notifications/')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              count: 1,
              next: null,
              previous: null,
              results: [
                {
                  id: 'n-1',
                  title: 'Document Indexed',
                  message: 'DHA Phase 6 Brochure vectorized cleanly.',
                  level: 'success',
                  is_read: false,
                  metadata: {},
                  created_at: '2026-11-18T08:00:00Z',
                },
              ],
            }),
            { status: 200 },
          ),
        );
      }
      return Promise.resolve(new Response(JSON.stringify({ count: 0, results: [] }), { status: 200 }));
    });

    vi.stubGlobal('fetch', fetchMock);

    render(
      <AuthProvider>
        <MemoryRouter>
          <NotificationsSection />
        </MemoryRouter>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Document Indexed')).toBeInTheDocument();
    });
  });

  it('renders OverviewSection KPIs, charts, and execution/activity tables', async () => {
    setStoredTokens({ access: 'tok', refresh: 'ref' });
    setStoredOrgId('org-1');

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/auth/me/')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              user: { id: 'u1', email: 'a@b.com', full_name: 'Admin', avatar_url: '', email_verified: true, created_at: '' },
              organizations: [{ id: 'org-1', name: 'Indus Horizon Realty', slug: 'indus-horizon', role: 'owner' }],
            }),
            { status: 200 },
          ),
        );
      }
      if (url.includes('/analytics/overview/')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              kpis: {
                active_agents: 2,
                total_agents: 3,
                indexed_documents: 12,
                total_conversations: 44,
                total_leads: 18,
                qualified_leads: 11,
                active_workflows: 4,
                successful_workflow_runs: 29,
              },
              usage: {
                period: '2026-11',
                ai_requests: 120,
                tokens: 45000,
                conversations: 44,
                workflow_executions: 29,
                api_calls: 200,
                agents: 3,
                documents: 12,
                storage_mb: 14,
              },
              limits: {
                name: 'Pro',
                price_monthly_cents: 4900,
                max_agents: 10,
                max_ai_requests_monthly: 5000,
                max_tokens_monthly: 2000000,
                max_documents: 500,
                max_storage_mb: 1024,
                max_workflow_executions_monthly: 2500,
              },
            }),
            { status: 200 },
          ),
        );
      }
      return Promise.resolve(new Response(JSON.stringify({ count: 0, results: [] }), { status: 200 }));
    });

    vi.stubGlobal('fetch', fetchMock);

    render(
      <AuthProvider>
        <MemoryRouter>
          <OverviewSection onNavigate={() => {}} />
        </MemoryRouter>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Workspace Activity Distribution')).toBeInTheDocument();
      expect(screen.getByText('Recent Workflow Executions')).toBeInTheDocument();
      expect(screen.getByText('Recent Workspace Activity')).toBeInTheDocument();
    });
  });
});
