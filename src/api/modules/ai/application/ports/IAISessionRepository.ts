export interface AISessionDto {
  id: string;
  tenantId: string;
  contactId: string;
  status: string;
  totalTokens: number;
  metadata: Record<string, unknown>;
}

export interface AISessionMessageData {
  tenantId: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  tokens: number;
  diagnostics: Record<string, unknown>;
}

export interface IAISessionRepository {
  findActive(
    tenantId: string,
    contactId: string,
    conversationId: string,
  ): Promise<AISessionDto | null>;
  createActive(
    tenantId: string,
    contactId: string,
    conversationId: string,
  ): Promise<AISessionDto>;
  recordMessage(data: AISessionMessageData): Promise<void>;
  close(
    tenantId: string,
    sessionId: string,
    status: 'CLOSED' | 'EXPIRED' | 'HANDOFF',
  ): Promise<void>;
}

export const AI_SESSION_REPOSITORY = Symbol('AI_SESSION_REPOSITORY');
