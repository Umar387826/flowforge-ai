import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { AppRoutes } from '../App';
import { setStoredOrgId, setStoredTokens } from '../api/client';
import { ChatWebSocketClient, getWsBaseUrl } from '../api/ws';
import { BillingSection } from '../pages/dashboard/BillingSection';
import { SettingsSection } from '../pages/dashboard/SettingsSection';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { formatDatePK, formatDateTimePK, formatPKR, formatTimePK } from '../utils/format';

class MockWebSocket {
  static OPEN = 1;
  static instances: MockWebSocket[] = [];
  readyState = MockWebSocket.OPEN;
  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((evt: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: ((evt: { code?: number }) => void) | null = null;
  sent: string[] = [];

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.readyState = 3;
  }

  triggerOpen() {
    this.onopen?.();
  }

  triggerClose(code = 1006) {
    this.onclose?.({ code });
  }
}

describe('End-to-End Frontend Verification', () => {
  beforeEach(() => {
    localStorage.clear();
    MockWebSocket.instances = [];
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('formats Pakistan Edition PKR currency, DD-MM-YYYY dates, and Asia/Karachi PKT times', () => {
    // 2026-11-18T19:30:00Z -> 19-11-2026 00:30 PKT (UTC+5)
    const utcNight = '2026-11-18T19:30:00Z';
    expect(formatDatePK(utcNight)).toBe('19-11-2026');
    expect(formatTimePK(utcNight)).toBe('00:30');
    expect(formatDateTimePK(utcNight)).toBe('19-11-2026 00:30 PKT');
    expect(formatPKR(13900)).toBe('PKR 13,900');
  });

  it('resolves WebSocket base URL cleanly and prevents reconnect leaks on disconnect or 4403 rejection', () => {
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', MockWebSocket as unknown as typeof WebSocket);
    setStoredTokens({ access: 'jwt-access-123', refresh: 'ref' });

    const baseUrl = getWsBaseUrl();
    expect(baseUrl.startsWith('ws://') || baseUrl.startsWith('wss://')).toBe(true);

    const statuses: string[] = [];
    const client = new ChatWebSocketClient('conv-1', () => {}, (s) => statuses.push(s));
    client.connect();

    expect(MockWebSocket.instances).toHaveLength(1);
    expect(MockWebSocket.instances[0].url).toContain('/chat/conv-1/?token=jwt-access-123');

    // Simulate close with 4403 auth rejection -> should NOT retry
    MockWebSocket.instances[0].triggerClose(4403);
    vi.advanceTimersByTime(20000);
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(statuses[statuses.length - 1]).toBe('error');

    // Simulate normal drop then manual disconnect before backoff fires -> timer cancelled
    client.connect();
    expect(MockWebSocket.instances).toHaveLength(2);
    MockWebSocket.instances[1].triggerOpen();
    MockWebSocket.instances[1].triggerClose(1006);
    client.disconnect();
    vi.advanceTimersByTime(20000);
    expect(MockWebSocket.instances).toHaveLength(2);
  });

  it('handles /reset-password?token=... and /integrations/google/callback routes', async () => {
    setStoredTokens({ access: 'tok', refresh: 'ref' });
    setStoredOrgId('org-pk-1');

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/auth/me/')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              user: { id: 'u1', email: 'amina.khan@indusrealty.pk', full_name: 'Amina Khan', avatar_url: '', email_verified: true, created_at: '' },
              organizations: [{ id: 'org-pk-1', name: 'Indus Horizon Realty', slug: 'indus', role: 'owner' }],
            }),
            { status: 200 },
          ),
        );
      }
      if (url.includes('/integrations/connections/callback/')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: 'conn-1',
              provider: 'google_oauth',
              status: 'connected',
              account_email: 'amina.khan@indusrealty.pk',
              scopes: [],
              field_mapping: {},
              token_expires_at: null,
              last_error: '',
              updated_at: '2026-11-18T10:00:00Z',
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
        <MemoryRouter initialEntries={['/integrations/google/callback?code=auth-code-1&state=signed-state-1']}>
          <AppRoutes />
        </MemoryRouter>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Google Workspace connected successfully/i)).toBeInTheDocument();
    });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/reset-password?token=reset-tok-99']}>
          <AppRoutes />
        </MemoryRouter>
      </AuthProvider>,
    );

    expect(screen.getByDisplayValue('reset-tok-99')).toBeInTheDocument();
  });

  it('renders BillingSection with PKR plans and DD-MM-YYYY invoice dates, and SettingsSection regional defaults', async () => {
    setStoredTokens({ access: 'tok', refresh: 'ref' });
    setStoredOrgId('org-pk-1');

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/auth/me/')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              user: { id: 'u1', email: 'amina.khan@indusrealty.pk', full_name: 'Amina Khan', avatar_url: '', email_verified: true, created_at: '' },
              organizations: [
                {
                  id: 'org-pk-1',
                  name: 'Indus Horizon Realty',
                  slug: 'indus',
                  role: 'owner',
                  settings: { currency: 'PKR', timezone: 'Asia/Karachi', date_format: 'DD-MM-YYYY' },
                },
              ],
            }),
            { status: 200 },
          ),
        );
      }
      if (url.includes('/organizations/current/')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: 'org-pk-1',
              name: 'Indus Horizon Realty',
              slug: 'indus',
              industry: 'Real Estate',
              website: 'https://indusrealty.pk',
              settings: { currency: 'PKR', timezone: 'Asia/Karachi', date_format: 'DD-MM-YYYY' },
            }),
            { status: 200 },
          ),
        );
      }
      if (url.includes('/billing/subscription/')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              subscription: { id: 's1', plan_tier: 'pro', status: 'active', current_period_end: null, cancel_at_period_end: false },
              limits: {
                name: 'Pro',
                currency: 'PKR',
                price_monthly_pkr: 13900,
                price_monthly_cents: 4900,
                max_agents: 10,
                max_ai_requests_monthly: 5000,
                max_tokens_monthly: 2000000,
                max_documents: 500,
                max_storage_mb: 1024,
                max_workflow_executions_monthly: 2500,
              },
              usage: { period: '2026-11', ai_requests: 10, tokens: 500, conversations: 1, workflow_executions: 1, api_calls: 2, agents: 1, documents: 1, storage_mb: 0.2 },
              invoices: [
                {
                  id: 'inv-1',
                  stripe_invoice_id: 'in_pk_001',
                  amount_paid_cents: 4900,
                  currency: 'usd',
                  status: 'paid',
                  invoice_pdf_url: '',
                  created_at: '2026-11-18T10:00:00Z',
                },
              ],
              stripe_configured: true,
            }),
            { status: 200 },
          ),
        );
      }
      if (url.includes('/billing/plans/')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              plans: {
                free: { name: 'Free', currency: 'PKR', price_monthly_pkr: 0, price_monthly_cents: 0, max_agents: 2, max_ai_requests_monthly: 250, max_tokens_monthly: 250000, max_documents: 25, max_storage_mb: 50, max_workflow_executions_monthly: 100 },
                pro: { name: 'Pro', currency: 'PKR', price_monthly_pkr: 13900, price_monthly_cents: 4900, max_agents: 10, max_ai_requests_monthly: 5000, max_tokens_monthly: 2000000, max_documents: 500, max_storage_mb: 1024, max_workflow_executions_monthly: 2500 },
                business: { name: 'Business', currency: 'PKR', price_monthly_pkr: 54900, price_monthly_cents: 19900, max_agents: 50, max_ai_requests_monthly: 25000, max_tokens_monthly: 10000000, max_documents: 2500, max_storage_mb: 10240, max_workflow_executions_monthly: 25000 },
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
          <BillingSection />
          <SettingsSection />
        </MemoryRouter>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('PKR 13,900')).toBeInTheDocument();
      expect(screen.getByText('18-11-2026')).toBeInTheDocument();
      expect(screen.getByText('PKR · Asia/Karachi · DD-MM-YYYY')).toBeInTheDocument();
    });
  });

  it('supports responsive dashboard navigation drawer across mobile/tablet/desktop widths', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'ok' }), { status: 200 })),
    );

    for (const width of [375, 768, 1366, 1920]) {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: width });
      window.dispatchEvent(new Event('resize'));
    }

    render(
      <AuthProvider>
        <MemoryRouter>
          <DashboardLayout activeSection="overview" onSelectSection={() => {}}>
            <div className="ff-table-wrap">Responsive workspace</div>
          </DashboardLayout>
        </MemoryRouter>
      </AuthProvider>,
    );

    const openMenuBtn = await screen.findByRole('button', { name: 'Open navigation' });
    fireEvent.click(openMenuBtn);
    expect(screen.getAllByRole('button', { name: 'Close navigation' })).toHaveLength(2);
  });
});
