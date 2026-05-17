import {
  AISessionDto,
  IAISessionRepository,
} from '../ports/IAISessionRepository';

export class AISessionService {
  constructor(private readonly repository: IAISessionRepository) {}

  async getOrCreateSession(
    tenantId: string,
    contactId: string,
    conversationId: string,
  ): Promise<AISessionDto> {
    return (
      (await this.repository.findActive(tenantId, contactId, conversationId)) ??
      this.repository.createActive(tenantId, contactId, conversationId)
    );
  }

  async recordMessage(
    sessionId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    tokens: number = 0,
    diagnostics: any = {},
  ): Promise<void> {
    await this.repository.recordMessage({
      sessionId,
      role,
      content,
      tokens,
      diagnostics,
    });
  }

  async closeSession(
    sessionId: string,
    status: 'CLOSED' | 'EXPIRED' | 'HANDOFF' = 'CLOSED',
  ): Promise<void> {
    await this.repository.close(sessionId, status);
  }
}
