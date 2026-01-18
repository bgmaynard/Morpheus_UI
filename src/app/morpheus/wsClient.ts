/**
 * Morpheus WebSocket Client
 *
 * Connects to Morpheus_AI event stream.
 * Handles reconnection and event parsing.
 */

import { MorpheusEvent, parseEvent } from './eventTypes';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected';

export interface WSClientConfig {
  url: string;
  reconnectInterval: number;
  maxReconnectAttempts: number;
  onEvent: (event: MorpheusEvent) => void;
  onStateChange: (state: ConnectionState) => void;
}

export class MorpheusWSClient {
  private ws: WebSocket | null = null;
  private config: WSClientConfig;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isManualClose = false;

  constructor(config: WSClientConfig) {
    this.config = config;
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    this.isManualClose = false;
    this.config.onStateChange('connecting');

    try {
      this.ws = new WebSocket(this.config.url);

      this.ws.onopen = () => {
        console.log('WebSocket connected to Morpheus');
        this.reconnectAttempts = 0;
        this.config.onStateChange('connected');
      };

      this.ws.onmessage = (event) => {
        // Handle both single events and newline-delimited events
        const data = event.data as string;
        const lines = data.split('\n').filter((line) => line.trim());

        for (const line of lines) {
          const parsed = parseEvent(line);
          if (parsed) {
            this.config.onEvent(parsed);
          }
        }
      };

      this.ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        this.config.onStateChange('disconnected');
        this.ws = null;

        if (!this.isManualClose) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        // onclose will be called after this
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      this.config.onStateChange('disconnected');
      this.scheduleReconnect();
    }
  }

  disconnect(): void {
    this.isManualClose = true;
    this.clearReconnectTimer();

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.config.onStateChange('disconnected');
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.log('Max reconnect attempts reached');
      return;
    }

    this.clearReconnectTimer();

    const delay = Math.min(
      this.config.reconnectInterval * Math.pow(2, this.reconnectAttempts),
      30000 // Max 30 seconds
    );

    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  get state(): ConnectionState {
    if (!this.ws) return 'disconnected';
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'connecting';
      case WebSocket.OPEN:
        return 'connected';
      default:
        return 'disconnected';
    }
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// Singleton instance (optional, can also create per-component)
let wsClientInstance: MorpheusWSClient | null = null;

export function createWSClient(config: WSClientConfig): MorpheusWSClient {
  if (wsClientInstance) {
    wsClientInstance.disconnect();
  }
  wsClientInstance = new MorpheusWSClient(config);
  return wsClientInstance;
}

export function getWSClient(): MorpheusWSClient | null {
  return wsClientInstance;
}
