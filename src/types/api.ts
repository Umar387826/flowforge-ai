export type OrgRole = 'owner' | 'admin' | 'manager' | 'member';

export interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string;
  email_verified: boolean;
  created_at: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  industry?: string;
  website?: string;
  role?: OrgRole;
  settings?: Record<string, unknown>;
  created_at?: string;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface AIAgent {
  id: string;
  name: string;
  description: string;
  system_instructions: string;
  llm_provider: 'anthropic' | 'openai' | 'ollama';
  model_name: string;
  temperature: number;
  max_tokens: number;
  is_active: boolean;
  knowledge_base_ids: string[];
  enabled_tools: string[];
  widget_config: Record<string, unknown>;
  public_embed_key: string;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeBase {
  id: string;
  name: string;
  description: string;
  embedding_model: string;
  chunk_size: number;
  chunk_overlap: number;
  document_count: number;
  chunk_count: number;
  created_at: string;
}

export interface DocumentItem {
  id: string;
  knowledge_base: string;
  knowledge_base_name: string;
  title: string;
  mime_type: string;
  file_size: number;
  sha256_checksum: string;
  status: 'pending' | 'processing' | 'indexed' | 'failed';
  chunk_count: number;
  celery_task_id: string;
  error_message: string;
  created_at: string;
}

export interface Citation {
  source_number: number;
  document_id: string;
  document_title: string;
  chunk_index: number;
  similarity: number;
  excerpt: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations: Citation[];
  token_usage: { input_tokens?: number; output_tokens?: number; total_tokens?: number };
  created_at: string;
}

export interface Conversation {
  id: string;
  agent: string;
  agent_name: string;
  title: string;
  channel: 'dashboard' | 'widget' | 'api';
  visitor_email: string;
  is_closed: boolean;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  company: string;
  preferences: Record<string, unknown>;
  qualification_score: number;
  qualification_reason: string;
  status: 'new' | 'qualified' | 'disqualified' | 'synced';
  crm_external_id: string;
  created_at: string;
}

export interface WorkflowConditionRule {
  field: string;
  op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'exists';
  value?: string | number | boolean;
}

export interface WorkflowActionDef {
  type:
    | 'ai_qualify_lead'
    | 'hubspot_create_contact'
    | 'hubspot_update_contact'
    | 'send_webhook'
    | 'send_notification'
    | 'update_record';
  config: Record<string, unknown>;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  trigger_type:
    | 'lead_captured'
    | 'new_conversation'
    | 'ai_event'
    | 'webhook_received'
    | 'scheduled'
    | 'document_indexed';
  trigger_config: Record<string, unknown>;
  conditions: { operator: 'AND' | 'OR'; rules: WorkflowConditionRule[] };
  actions: WorkflowActionDef[];
  is_active: boolean;
  execution_count: number;
  created_at: string;
}

export interface WorkflowExecution {
  id: string;
  workflow: string;
  workflow_name: string;
  idempotency_key: string;
  status: 'pending' | 'running' | 'succeeded' | 'skipped' | 'failed';
  trigger_payload: Record<string, unknown>;
  step_logs: Array<Record<string, unknown>>;
  error_message: string;
  retry_count: number;
  created_at: string;
  completed_at: string | null;
}

export interface IntegrationConnection {
  id: string;
  provider: 'google_oauth' | 'hubspot';
  status: 'connected' | 'disconnected' | 'error' | 'awaiting_credentials';
  account_email: string;
  scopes: string[];
  field_mapping: Record<string, string>;
  token_expires_at: string | null;
  last_error: string;
  updated_at: string;
}

export interface WebhookEndpoint {
  id: string;
  name: string;
  direction: 'inbound' | 'outbound';
  url: string;
  signing_secret: string;
  is_active: boolean;
  subscribed_events: string[];
  created_at: string;
}

export interface SyncLog {
  id: string;
  provider: string;
  resource_type: string;
  resource_id: string;
  external_id: string;
  status: string;
  error_message: string;
  created_at: string;
}

export interface PlanQuota {
  name: string;
  currency?: string;
  price_monthly_pkr?: number;
  price_monthly_cents: number;
  max_agents: number;
  max_ai_requests_monthly: number;
  max_tokens_monthly: number;
  max_documents: number;
  max_storage_mb: number;
  max_workflow_executions_monthly: number;
}

export interface SubscriptionInfo {
  subscription: {
    id: string;
    plan_tier: 'free' | 'pro' | 'business';
    status: string;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
  };
  limits: PlanQuota;
  usage: {
    period: string;
    ai_requests: number;
    tokens: number;
    conversations: number;
    workflow_executions: number;
    api_calls: number;
    agents: number;
    documents: number;
    storage_mb: number;
  };
  invoices: Array<{
    id: string;
    stripe_invoice_id: string;
    amount_paid_cents: number;
    currency: string;
    status: string;
    invoice_pdf_url: string;
    created_at: string;
  }>;
  stripe_configured: boolean;
}

export interface OrganizationMember {
  id: string;
  user: User;
  role: OrgRole;
  is_active: boolean;
  created_at: string;
}

export interface OrganizationInvitation {
  id: string;
  email: string;
  role: OrgRole;
  status: string;
  expires_at: string;
  created_at: string;
}

export interface AuditLogItem {
  id: string;
  actor_email: string;
  action: string;
  resource_type: string;
  resource_id: string;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  correlation_id: string;
  created_at: string;
}

export interface AnalyticsOverview {
  kpis: {
    active_agents: number;
    total_agents: number;
    indexed_documents: number;
    total_conversations: number;
    total_leads: number;
    qualified_leads: number;
    active_workflows: number;
    successful_workflow_runs: number;
  };
  usage: SubscriptionInfo['usage'];
  limits: PlanQuota;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  level: 'info' | 'success' | 'warning' | 'error';
  is_read: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}
