import { describe, expect, it, vi, beforeEach } from 'vitest';
import { apiRequest, FlowForgeApiError, setStoredOrgId, setStoredTokens } from '../api/client';

describe('FlowForge API Client', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('injects Authorization Bearer token and X-Organization-ID header', async () => {
    setStoredTokens({ access: 'access-123', refresh: 'refresh-456' });
    setStoredOrgId('org-uuid-789');

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ results: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await apiRequest('/agents/');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    const headers = init.headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer access-123');
    expect(headers.get('X-Organization-ID')).toBe('org-uuid-789');
  });

  it('rotates JWT access token on 401 and retries request', async () => {
    setStoredTokens({ access: 'expired-access', refresh: 'valid-refresh' });
    setStoredOrgId('org-uuid-1');

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ detail: 'Token expired' }), { status: 401 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access: 'new-access-999', refresh: 'new-refresh-999' }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    vi.stubGlobal('fetch', fetchMock);

    const res = await apiRequest<{ ok: boolean }>('/agents/');
    expect(res.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('throws structured FlowForgeApiError on backend error responses', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'Quota exceeded for Free plan' } }), { status: 402 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiRequest('/agents/', { skipAuth: true })).rejects.toThrow(FlowForgeApiError);
  });
});
