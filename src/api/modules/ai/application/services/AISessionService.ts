import { Inject, Injectable } from '@nestjs/common';
import {
  AISessionDto,
  AI_SESSION_REPOSITORY,
  IAISessionRepository,
} from '../ports/IAISessionRepository';

@Injectable()
export class AISessionService {
  constructor(
    @Inject(AI_SESSION_REPOSITORY)
    private readonly repository: IAISessionRepository,
  ) {}

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
    tenantId: string,
    sessionId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    tokens: number = 0,
    diagnostics: Record<string, unknown> = {},
  ): Promise<void> {
    await this.repository.recordMessage({
      tenantId,
      sessionId,
      role,
      content,
      tokens,
      diagnostics,
    });
  }

  async closeSession(
    tenantId: string,
    sessionId: string,
    status: 'CLOSED' | 'EXPIRED' | 'HANDOFF' = 'CLOSED',
  ): Promise<void> {
    await this.repository.close(tenantId, sessionId, status);
  }
}
