import { Inject, Injectable, Logger } from '@nestjs/common';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import {
  CHAT_HISTORY_REPOSITORY,
  IChatHistoryRepository,
} from '../ports/IChatHistoryRepository';
import { AISessionService } from './AISessionService';
import { AIEscalationRequestedIntegrationEvent } from '../integration-events/publishers/AIIntegrationEvents';
import {
  ProcessAIResponseInput,
  ProcessAIResponseOutput,
} from '../use-cases/interfaces/IProcessAIResponseUseCase';
import { Tenant } from '@modules/tenant/domain/entities/Tenant';

export interface HandoffInput {
  input: ProcessAIResponseInput;
  tenant: Tenant;
  response: { confidence?: number; text?: string };
  decision: { reason?: string; shouldHandoff: boolean };
  sessionId: string;
  userMessage: string;
}

@Injectable()
export class AIHandoffService {
  private readonly logger = new Logger(AIHandoffService.name);

  constructor(
    @Inject(CHAT_HISTORY_REPOSITORY)
    private readonly chatHistoryRepository: IChatHistoryRepository,
    private readonly aiSessionService: AISessionService,
    @Inject(EVENT_BUS)
    private readonly eventBus: IEventBus,
  ) {}

  async execute(params: HandoffInput): Promise<ProcessAIResponseOutput> {
    const { input, tenant, response, decision, sessionId, userMessage } = params;

    const escalationMessage =
      tenant.aiConfig?.escalationMessage || 'Encaminhando para um humano...';

    await this.chatHistoryRepository.saveMessage(input.conversationId, {
      role: 'assistant',
      content: escalationMessage,
      timestamp: new Date(),
    });

    await this.aiSessionService.closeSession(
      input.tenantId,
      sessionId,
      'HANDOFF',
    );

    await this.eventBus.publish(
      new AIEscalationRequestedIntegrationEvent({
        conversationId: input.conversationId,
        tenantId: input.tenantId,
        contactId: input.contactId,
        reason: decision.reason || 'HANDOFF_REQUIRED',
        confidence: response.confidence ?? 0,
        lastMessage: userMessage,
        escalationMessage,
      }),
    );

    return {
      success: false,
      error: 'HANDOFF_REQUIRED',
      message: 'Escalated to human.',
    };
  }
}
