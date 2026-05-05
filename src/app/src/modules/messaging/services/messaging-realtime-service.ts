import type { MessagingRealtimeEvent } from '@/shared/types';

/**
 * WebSocket (`/api/v1/ws/messaging`): eventos tipados em {@link MessagingRealtimeEvent}
 * (ex.: atualização de conversa/mensagem em tempo real). Complementa REST em `messaging-service`
 * (`GET/POST …/conversations`, mensagens, upload, status, suggest-reply, read).
 */

type MessagingRealtimeListener = (event: MessagingRealtimeEvent) => void;
type MessagingRealtimeStatus = 'connecting' | 'connected' | 'disconnected';
type MessagingRealtimeStatusListener = (status: MessagingRealtimeStatus) => void;

class MessagingRealtimeService {
  private socket: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private listeners = new Set<MessagingRealtimeListener>();
  private statusListeners = new Set<MessagingRealtimeStatusListener>();
  private tenantId: string | null = null;
  private manuallyClosed = false;
  private status: MessagingRealtimeStatus = 'disconnected';
  private reconnectAttempts = 0;

  subscribe(tenantId: string, listener: MessagingRealtimeListener): () => void {
    this.listeners.add(listener);

    if (this.tenantId !== tenantId) {
      this.tenantId = tenantId;
      this.restart();
    } else {
      this.connect();
    }

    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        this.disconnect();
      }
    };
  }

  subscribeStatus(
    tenantId: string,
    listener: MessagingRealtimeStatusListener,
  ): () => void {
    this.statusListeners.add(listener);
    listener(this.status);

    if (this.tenantId !== tenantId) {
      this.tenantId = tenantId;
      this.restart();
    } else {
      this.connect();
    }

    return () => {
      this.statusListeners.delete(listener);
      if (this.listeners.size === 0 && this.statusListeners.size === 0) {
        this.disconnect();
      }
    };
  }

  getStatus(): MessagingRealtimeStatus {
    return this.status;
  }

  private restart() {
    this.disconnect();
    this.connect();
  }

  private connect() {
    if (
      typeof window === 'undefined' ||
      !this.tenantId ||
      this.socket ||
      (this.listeners.size === 0 && this.statusListeners.size === 0)
    ) {
      return;
    }

    this.manuallyClosed = false;
    this.setStatus('connecting');
    this.socket = new window.WebSocket(this.buildUrl());

    this.socket.onopen = () => {
      this.reconnectAttempts = 0;
      this.setStatus('connected');
    };

    this.socket.onmessage = (message) => {
      try {
        const event = JSON.parse(message.data) as MessagingRealtimeEvent;
        if (event.tenantId !== this.tenantId) {
          return;
        }

        this.listeners.forEach((listener) => listener(event));
      } catch {
        return;
      }
    };

    this.socket.onclose = () => {
      this.socket = null;
      this.setStatus('disconnected');
      if (!this.manuallyClosed && this.listeners.size > 0) {
        this.scheduleReconnect();
      }
    };

    this.socket.onerror = () => {
      this.socket?.close();
    };
  }

  private disconnect() {
    this.manuallyClosed = true;
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.socket?.close();
    this.socket = null;
    this.setStatus('disconnected');
  }

  private scheduleReconnect() {
    if (this.reconnectTimer || typeof window === 'undefined') {
      return;
    }

    const nextDelay = Math.min(15000, 1500 * Math.max(1, this.reconnectAttempts + 1));
    this.reconnectAttempts += 1;

    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, nextDelay);
  }

  private buildUrl(): string {
    const configuredOrigin = (
      import.meta.env.VITE_API_ORIGIN as string | undefined
    )?.replace(/\/$/, '');
    const windowOrigin = window.location.origin.replace(/\/$/, '');
    const origin = this.resolveRealtimeOrigin(configuredOrigin, windowOrigin);
    const websocketOrigin = origin.replace(/^http/, 'ws');
    return `${websocketOrigin}/api/v1/ws/messaging`;
  }

  private resolveRealtimeOrigin(
    configuredOrigin: string | undefined,
    windowOrigin: string,
  ) {
    if (!configuredOrigin) {
      try {
        const windowUrl = new URL(windowOrigin);
        const localHosts = new Set(['localhost', '127.0.0.1', '::1']);

        if (localHosts.has(windowUrl.hostname)) {
          return `${windowUrl.protocol}//${windowUrl.hostname}:3000`;
        }
      } catch {
        return windowOrigin;
      }

      return windowOrigin;
    }

    try {
      const configuredUrl = new URL(configuredOrigin);
      const windowUrl = new URL(windowOrigin);
      const localHosts = new Set(['localhost', '127.0.0.1', '::1']);

      if (
        configuredUrl.hostname !== windowUrl.hostname &&
        localHosts.has(configuredUrl.hostname) &&
        localHosts.has(windowUrl.hostname)
      ) {
        return windowOrigin;
      }

      return configuredOrigin;
    } catch {
      return windowOrigin;
    }
  }

  private setStatus(status: MessagingRealtimeStatus) {
    if (this.status === status) {
      return;
    }

    this.status = status;
    this.statusListeners.forEach((listener) => listener(status));
  }
}

export const messagingRealtimeService = new MessagingRealtimeService();
