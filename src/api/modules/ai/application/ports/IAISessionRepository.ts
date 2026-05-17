export interface AISessionDto {
  id: string;
  tenantId: string;
  contactId: string;
  status: string;
  totalTokens: number;
  metadata: any;
}

export interface AISessionMessageData {
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  tokens: number;
  diagnostics: any;
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
    sessionId: string,
    status: 'CLOSED' | 'EXPIRED' | 'HANDOFF',
  ): Promise<void>;
}

export const AI_SESSION_REPOSITORY = Symbol('AI_SESSION_REPOSITORY');
