import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import {
  IWidgetConfigRepository,
  WIDGET_CONFIG_REPOSITORY,
} from '@modules/messaging/domain/repositories/IWidgetConfigRepository';
import {
  IWidgetSessionRepository,
  WIDGET_SESSION_REPOSITORY,
} from '@modules/messaging/domain/repositories/IWidgetSessionRepository';
import {
  IUpdateConversationStatusUseCase,
  UpdateConversationStatusInput,
} from './interfaces/IUpdateConversationStatusUseCase';

export interface CloseWidgetSessionInput {
  publicToken: string;
  sessionId: string;
  tenantId?: string;
}

@Injectable()
export class CloseWidgetSessionUseCase {
  constructor(
    @Inject(WIDGET_CONFIG_REPOSITORY)
    private readonly configRepo: IWidgetConfigRepository,
    @Inject(WIDGET_SESSION_REPOSITORY)
    private readonly sessionRepo: IWidgetSessionRepository,
    @Inject(IUpdateConversationStatusUseCase)
    private readonly updateStatus: IUpdateConversationStatusUseCase,
  ) {}

  async execute(input: CloseWidgetSessionInput): Promise<void> {
    const config = await this.configRepo.findByPublicToken(input.publicToken);
    if (!config || !config.enabled) {
      throw new NotFoundException('Widget not found or disabled');
    }

    const session = await this.sessionRepo.findById(input.sessionId, config.tenantId);
    if (!session) {
      throw new NotFoundException('Session not found');
    }

    await this.sessionRepo.close(session.id, config.tenantId);

    if (session.conversationId) {
      await this.updateStatus.execute({
        tenantId: config.tenantId,
        conversationId: session.conversationId,
        status: 'ARCHIVED',
      });
    }
  }
}
