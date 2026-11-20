import { getStoredTokens } from './client';
import type { Citation } from '../types/api';

export interface WSChatEvent {
  type:
    | 'connection_established'
    | 'user_message'
    | 'assistant_token'
    | 'assistant_complete'
    | 'error'
    | 'pong';
  conversation_id?: string;
  content?: string;
  token?: string;
  message_id?: string;
  citations?: Citation[];
  token_usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number };
  captured_lead_id?: string | null;
  detail?: string;
  code?: string;
}

export function getWsBaseUrl(): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const configured = (import.meta.env.VITE_WS_URL || '').trim().replace(/\/$/, '');
  if (configured) {
    if (configured.startsWith('/')) {
      return `${proto}//${window.location.host}${configured}`;
    }
    if (configured.startsWith('http://')) {
      return `ws://${configured.slice('http://'.length)}`;
    }
    if (configured.startsWith('https://')) {
      return `wss://${configured.slice('https://'.length)}`;
    }
    return configured;
  }
  return `${proto}//${window.location.host}/ws`;
}

export class ChatWebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private closedManually = false;
  private authRejected = false;
  private pingTimer: number | null = null;
  private reconnectTimer: number | null = null;
  private conversationId: string;
  private widgetToken?: string;
  private onEvent: (ev: WSChatEvent) => void;
  private onStatusChange: (status: 'connecting' | 'connected' | 'disconnected' | 'error') => void;

  constructor(
    conversationId: string,
    onEvent: (ev: WSChatEvent) => void,
    onStatusChange: (status: 'connecting' | 'connected' | 'disconnected' | 'error') => void,
    widgetToken?: string,
  ) {
    this.conversationId = conversationId;
    this.onEvent = onEvent;
    this.onStatusChange = onStatusChange;
    this.widgetToken = widgetToken;
  }

  connect() {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.closedManually = false;
    this.authRejected = false;
    this.onStatusChange('connecting');
    const base = getWsBaseUrl();
    const qs = new URLSearchParams();
    if (this.widgetToken) {
      qs.set('widget_token', this.widgetToken);
    } else {
      const tokens = getStoredTokens();
      if (tokens?.access) {
        qs.set('token', tokens.access);
      }
    }

    const url = `${base}/chat/${this.conversationId}/?${qs.toString()}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.onStatusChange('connected');
      this.pingTimer = window.setInterval(() => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 25000);
    };

    this.ws.onmessage = (evt) => {
      try {
        const parsed = JSON.parse(evt.data) as WSChatEvent;
        this.onEvent(parsed);
      } catch {
        // Ignore malformed frame
      }
    };

    this.ws.onerror = () => {
      this.onStatusChange('error');
    };

    this.ws.onclose = (evt) => {
      if (this.pingTimer !== null) {
        clearInterval(this.pingTimer);
        this.pingTimer = null;
      }
      if (evt?.code === 4403) {
        this.authRejected = true;
        this.onStatusChange('error');
        return;
      }
      this.onStatusChange('disconnected');
      if (!this.closedManually && !this.authRejected && this.reconnectAttempts < 5) {
        const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 15000);
        this.reconnectAttempts += 1;
        this.reconnectTimer = window.setTimeout(() => {
          this.reconnectTimer = null;
          if (!this.closedManually) {
            this.connect();
          }
        }, delay);
      }
    };
  }

  sendMessage(content: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'chat_message', content }));
      return true;
    }
    return false;
  }

  disconnect() {
    this.closedManually = true;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.pingTimer !== null) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }
}
