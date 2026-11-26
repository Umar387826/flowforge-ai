import type {
  AIAgent,
  AnalyticsOverview,
  AuditLogItem,
  ChatMessage,
  Conversation,
  DocumentItem,
  IntegrationConnection,
  KnowledgeBase,
  Lead,
  NotificationItem,
  Organization,
  OrganizationInvitation,
  OrganizationMember,
  PaginatedResponse,
  PlanQuota,
  SubscriptionInfo,
  SyncLog,
  User,
  WebhookEndpoint,
  Workflow,
  WorkflowExecution,
} from '../types/api';

const API_BASE = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/$/, '');

export class FlowForgeApiError extends Error {
  status: number;
  details: unknown;
  isNetworkError: boolean;

  constructor(message: string, status = 0, details: unknown = null, isNetworkError = false) {
    super(message);
    this.name = 'FlowForgeApiError';
    this.status = status;
    this.details = details;
    this.isNetworkError = isNetworkError;
  }
}

const TOKEN_STORAGE_KEY = 'flowforge_tokens';
const ORG_STORAGE_KEY = 'flowforge_active_org';

export function getStoredTokens(): { access: string; refresh: string } | null {
  try {
    const raw = localStorage.getItem(TOKEN_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredTokens(tokens: { access: string; refresh: string } | null) {
  if (!tokens) {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  } else {
    localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
  }
}

export function getStoredOrgId(): string | null {
  return localStorage.getItem(ORG_STORAGE_KEY);
}

export function setStoredOrgId(orgId: string | null) {
  if (!orgId) {
    localStorage.removeItem(ORG_STORAGE_KEY);
  } else {
    localStorage.setItem(ORG_STORAGE_KEY, orgId);
  }
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  const tokens = getStoredTokens();
  if (!tokens?.refresh) return null;

  refreshPromise = (async () => {
    try {
      const resp = await fetch(`${API_BASE}/auth/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: tokens.refresh }),
      });
      if (!resp.ok) {
        setStoredTokens(null);
        return null;
      }
      const data = await resp.json();
      const updated = { access: data.access, refresh: data.refresh || tokens.refresh };
      setStoredTokens(updated);
      return updated.access;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit & { skipAuth?: boolean; orgId?: string | null } = {},
): Promise<T> {
  const { skipAuth, orgId, headers: customHeaders, body, ...rest } = options;
  const headers = new Headers(customHeaders);

  if (!(body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (!skipAuth) {
    const tokens = getStoredTokens();
    if (tokens?.access) {
      headers.set('Authorization', `Bearer ${tokens.access}`);
    }
    const activeOrg = orgId !== undefined ? orgId : getStoredOrgId();
    if (activeOrg) {
      headers.set('X-Organization-ID', activeOrg);
    }
  }

  let resp: Response;
  try {
    resp = await fetch(`${API_BASE}${path}`, { ...rest, headers, body });
  } catch (err) {
    throw new FlowForgeApiError(
      'Unable to reach FlowForge Django backend API. Start the backend server or Docker stack.',
      0,
      err,
      true,
    );
  }

  if (resp.status === 401 && !skipAuth) {
    const newAccess = await refreshAccessToken();
    if (newAccess) {
      headers.set('Authorization', `Bearer ${newAccess}`);
      resp = await fetch(`${API_BASE}${path}`, { ...rest, headers, body });
    }
  }

  if (resp.status === 204) {
    return undefined as T;
  }

  let data: unknown = null;
  const text = await resp.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { detail: text };
    }
  }

  if (!resp.ok) {
    const errObj = data as { error?: { message?: string; details?: unknown }; detail?: string };
    const msg = errObj?.error?.message || errObj?.detail || `Request failed (${resp.status})`;
    throw new FlowForgeApiError(msg, resp.status, errObj?.error?.details ?? data, false);
  }

  return data as T;
}

export const api = {
  health: () => apiRequest<{ status: string }>('/health/', { skipAuth: true }),

  // Auth
  login: (payload: { email: string; password: string }) =>
    apiRequest<{ user: User; organizations: Organization[]; tokens: { access: string; refresh: string } }>(
      '/auth/login/',
      { method: 'POST', body: JSON.stringify(payload), skipAuth: true },
    ),
  googleLogin: (credential: string) =>
    apiRequest<{ user: User; organizations: Organization[]; tokens: { access: string; refresh: string } }>(
      '/auth/google/',
      { method: 'POST', body: JSON.stringify({ credential }), skipAuth: true },
    ),
  register: (payload: { email: string; full_name: string; password: string; organization_name?: string }) =>
    apiRequest<{ user: User; organizations: Organization[]; tokens: { access: string; refresh: string } }>(
      '/auth/register/',
      { method: 'POST', body: JSON.stringify(payload), skipAuth: true },
    ),
  logout: (refresh: string) =>
    apiRequest<{ detail: string }>('/auth/logout/', { method: 'POST', body: JSON.stringify({ refresh }) }),
  me: () => apiRequest<{ user: User; organizations: Organization[] }>('/auth/me/'),
  updateProfile: (payload: Partial<User>) =>
    apiRequest<{ user: User }>('/auth/me/', { method: 'PATCH', body: JSON.stringify(payload) }),
  requestPasswordReset: (email: string) =>
    apiRequest<{ detail: string }>('/auth/password-reset/', {
      method: 'POST',
      body: JSON.stringify({ email }),
      skipAuth: true,
    }),
  confirmPasswordReset: (token: string, new_password: string) =>
    apiRequest<{ detail: string }>('/auth/password-reset/confirm/', {
      method: 'POST',
      body: JSON.stringify({ token, new_password }),
      skipAuth: true,
    }),

  // Organizations
  listOrganizations: () => apiRequest<Organization[]>('/organizations/'),
  createOrganization: (payload: { name: string; industry?: string; website?: string }) =>
    apiRequest<Organization>('/organizations/', { method: 'POST', body: JSON.stringify(payload) }),
  getCurrentOrganization: () => apiRequest<Organization>('/organizations/current/'),
  updateCurrentOrganization: (payload: Partial<Organization>) =>
    apiRequest<Organization>('/organizations/current/', { method: 'PATCH', body: JSON.stringify(payload) }),
  switchOrganization: (organization_id: string) =>
    apiRequest<{ organization: Organization; role: string }>('/organizations/switch/', {
      method: 'POST',
      body: JSON.stringify({ organization_id }),
    }),
  listMemberships: () => apiRequest<PaginatedResponse<OrganizationMember>>('/organizations/memberships/'),
  updateMemberRole: (id: string, role: string) =>
    apiRequest<OrganizationMember>(`/organizations/memberships/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),
  removeMember: (id: string) => apiRequest<void>(`/organizations/memberships/${id}/`, { method: 'DELETE' }),
  listInvitations: () => apiRequest<PaginatedResponse<OrganizationInvitation>>('/organizations/invitations/'),
  sendInvitation: (payload: { email: string; role: string }) =>
    apiRequest<OrganizationInvitation>('/organizations/invitations/', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  revokeInvitation: (id: string) => apiRequest<void>(`/organizations/invitations/${id}/`, { method: 'DELETE' }),
  acceptInvitation: (token: string) =>
    apiRequest<{ organization_id: string; role: string }>('/organizations/invitations/accept/', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),

  // Agents
  listAgents: (page = 1) => apiRequest<PaginatedResponse<AIAgent>>(`/agents/?page=${page}`),
  createAgent: (payload: Partial<AIAgent>) =>
    apiRequest<AIAgent>('/agents/', { method: 'POST', body: JSON.stringify(payload) }),
  updateAgent: (id: string, payload: Partial<AIAgent>) =>
    apiRequest<AIAgent>(`/agents/${id}/`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteAgent: (id: string) => apiRequest<void>(`/agents/${id}/`, { method: 'DELETE' }),
  toggleAgent: (id: string) => apiRequest<AIAgent>(`/agents/${id}/toggle_active/`, { method: 'POST' }),
  testAgentQuery: (id: string, message: string) =>
    apiRequest<{ answer: string; citations: unknown[]; token_usage: Record<string, number> }>(
      `/agents/${id}/test_query/`,
      { method: 'POST', body: JSON.stringify({ message }) },
    ),

  // Knowledge Bases
  listKnowledgeBases: () => apiRequest<PaginatedResponse<KnowledgeBase>>('/knowledge/'),
  createKnowledgeBase: (payload: Partial<KnowledgeBase>) =>
    apiRequest<KnowledgeBase>('/knowledge/', { method: 'POST', body: JSON.stringify(payload) }),
  deleteKnowledgeBase: (id: string) => apiRequest<void>(`/knowledge/${id}/`, { method: 'DELETE' }),
  queryKnowledgeBase: (id: string, query: string, top_k = 5) =>
    apiRequest<{
      query: string;
      results: Array<{
        chunk_id: string;
        document_title: string;
        chunk_index: number;
        similarity: number;
        content: string;
      }>;
    }>(`/knowledge/${id}/query/`, { method: 'POST', body: JSON.stringify({ query, top_k }) }),

  // Documents
  listDocuments: (page = 1) => apiRequest<PaginatedResponse<DocumentItem>>(`/documents/?page=${page}`),
  uploadDocument: (formData: FormData) =>
    apiRequest<DocumentItem>('/documents/', { method: 'POST', body: formData }),
  reprocessDocument: (id: string) => apiRequest<DocumentItem>(`/documents/${id}/reprocess/`, { method: 'POST' }),
  deleteDocument: (id: string) => apiRequest<void>(`/documents/${id}/`, { method: 'DELETE' }),

  // Conversations
  listConversations: () => apiRequest<PaginatedResponse<Conversation>>('/conversations/'),
  createConversation: (payload: { agent: string; title?: string }) =>
    apiRequest<Conversation>('/conversations/', { method: 'POST', body: JSON.stringify(payload) }),
  getConversationMessages: (id: string) => apiRequest<ChatMessage[]>(`/conversations/${id}/messages/`),
  sendMessageHttp: (id: string, content: string) =>
    apiRequest<{ user_message: ChatMessage; assistant_message: ChatMessage }>(
      `/conversations/${id}/send_message/`,
      { method: 'POST', body: JSON.stringify({ content }) },
    ),
  initPublicWidget: (embedKey: string) =>
    apiRequest<{ agent_name: string; description: string; organization_name: string; widget_config: Record<string, unknown> }>(
      `/conversations/widget/${embedKey}/`,
      { skipAuth: true },
    ),
  startPublicWidgetSession: (embedKey: string, email?: string) =>
    apiRequest<{ conversation_id: string; widget_token: string; agent_name: string }>(
      `/conversations/widget/${embedKey}/`,
      { method: 'POST', body: JSON.stringify({ email: email || '' }), skipAuth: true },
    ),

  // Leads
  listLeads: (statusFilter = '') =>
    apiRequest<PaginatedResponse<Lead>>(`/leads/${statusFilter ? `?status=${statusFilter}` : ''}`),
  createLead: (payload: Partial<Lead>) =>
    apiRequest<Lead>('/leads/', { method: 'POST', body: JSON.stringify(payload) }),
  qualifyLead: (id: string) => apiRequest<Lead>(`/leads/${id}/qualify/`, { method: 'POST' }),
  syncLeadHubspot: (id: string) =>
    apiRequest<{ lead: Lead; hubspot: { contact_id: string; status: string } }>(`/leads/${id}/sync_hubspot/`, {
      method: 'POST',
    }),
  deleteLead: (id: string) => apiRequest<void>(`/leads/${id}/`, { method: 'DELETE' }),

  // Workflows
  listWorkflows: () => apiRequest<PaginatedResponse<Workflow>>('/workflows/'),
  createWorkflow: (payload: Partial<Workflow>) =>
    apiRequest<Workflow>('/workflows/', { method: 'POST', body: JSON.stringify(payload) }),
  toggleWorkflow: (id: string) => apiRequest<Workflow>(`/workflows/${id}/toggle_active/`, { method: 'POST' }),
  triggerWorkflow: (id: string, payload: Record<string, unknown>) =>
    apiRequest<WorkflowExecution>(`/workflows/${id}/trigger/`, {
      method: 'POST',
      body: JSON.stringify({ payload }),
    }),
  deleteWorkflow: (id: string) => apiRequest<void>(`/workflows/${id}/`, { method: 'DELETE' }),
  listWorkflowExecutions: () => apiRequest<PaginatedResponse<WorkflowExecution>>('/workflows/executions/'),

  // Integrations & Webhooks
  listIntegrations: () =>
    apiRequest<{
      connections: IntegrationConnection[];
      credentials_status: { google_oauth: boolean; hubspot_oauth: boolean; hubspot_private_token: boolean };
    }>('/integrations/connections/'),
  connectIntegration: (provider: string, extra: Record<string, unknown> = {}) =>
    apiRequest<{ authorize_url?: string } & IntegrationConnection>('/integrations/connections/connect/', {
      method: 'POST',
      body: JSON.stringify({ provider, ...extra }),
    }),
  completeIntegrationCallback: (provider: 'google_oauth' | 'hubspot', code: string, state: string) =>
    apiRequest<IntegrationConnection>('/integrations/connections/callback/', {
      method: 'POST',
      body: JSON.stringify({ provider, code, state }),
    }),
  disconnectIntegration: (id: string) =>
    apiRequest<IntegrationConnection>(`/integrations/connections/${id}/disconnect/`, { method: 'POST' }),
  listWebhooks: () => apiRequest<PaginatedResponse<WebhookEndpoint>>('/integrations/webhooks/'),
  createWebhook: (payload: Partial<WebhookEndpoint>) =>
    apiRequest<WebhookEndpoint>('/integrations/webhooks/', { method: 'POST', body: JSON.stringify(payload) }),
  deleteWebhook: (id: string) => apiRequest<void>(`/integrations/webhooks/${id}/`, { method: 'DELETE' }),
  listSyncLogs: () => apiRequest<PaginatedResponse<SyncLog>>('/integrations/sync-logs/'),

  // Billing
  listPlans: () => apiRequest<{ plans: Record<string, PlanQuota> }>('/billing/plans/', { skipAuth: true }),
  getSubscription: () => apiRequest<SubscriptionInfo>('/billing/subscription/'),
  createCheckoutSession: (plan_tier: string) =>
    apiRequest<{ checkout_url: string; session_id: string }>('/billing/checkout/', {
      method: 'POST',
      body: JSON.stringify({ plan_tier }),
    }),
  createBillingPortal: () => apiRequest<{ portal_url: string }>('/billing/portal/', { method: 'POST' }),
  cancelSubscription: () => apiRequest<SubscriptionInfo['subscription']>('/billing/cancel/', { method: 'POST' }),

  // Analytics, Audit & Notifications
  getAnalyticsOverview: () => apiRequest<AnalyticsOverview>('/analytics/overview/'),
  listAuditLogs: (page = 1, search = '') =>
    apiRequest<PaginatedResponse<AuditLogItem>>(
      `/audit/?page=${page}${search ? `&search=${encodeURIComponent(search)}` : ''}`,
    ),
  listNotifications: () => apiRequest<PaginatedResponse<NotificationItem>>('/notifications/'),
  markNotificationRead: (id: string) =>
    apiRequest<NotificationItem>(`/notifications/${id}/mark_read/`, { method: 'POST' }),
};
