import { apiClient } from '@/lib/api-client';

export type DashboardChatEvent =
  | { type: 'token'; content: string }
  | { type: 'tool_start'; toolName: string }
  | { type: 'tool_end'; toolName: string }
  | { type: 'error'; content: string }
  | { type: 'done' };

export interface DashboardChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolName?: string;
  isStreaming?: boolean;
  createdAt: Date;
}

export class DashboardChatService {
  private abortController: AbortController | null = null;

  async *stream(
    tenantId: string,
    message: string,
    threadId?: string,
  ): AsyncGenerator<DashboardChatEvent> {
    const params = new URLSearchParams({ message });
    if (threadId) params.append('threadId', threadId);

    const url = `/ai/dashboard/${tenantId}/chat/stream?${params.toString()}`;
    this.abortController = new AbortController();

    try {
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        signal: this.abortController.signal,
        headers: { Accept: 'text/event-stream' },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6)) as DashboardChatEvent;
              yield event;
              if (event.type === 'done') return;
            } catch (e) {
              // Skip malformed
            }
          }
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') return;
      yield { type: 'error', content: error.message || 'Erro de conexão' };
      yield { type: 'done' };
    } finally {
      this.abortController = null;
    }
  }

  cancel(): void {
    this.abortController?.abort();
  }
}

export const dashboardChatService = new DashboardChatService();