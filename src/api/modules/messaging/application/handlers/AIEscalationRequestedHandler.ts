import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { EVENT_BUS, IEventBus } from '@shared/infrastructure/event-bus';
import {
  CONVERSATION_REPOSITORY,
  IConversationRepository,
} from '../../domain/repositories/IConversationRepository';
import { AIEscalationRequestedIntegrationEvent } from '@modules/ai/application/integration-events/publishers/AIIntegrationEvents';
import { SendAIMessageUseCase } from '../use-cases/SendAIMessageUseCase';
import { FollowUpService } from '../services/FollowUpService';

interface EscalationPayload {
  conversationId: string;
  escalationMessage: string;
}

@Injectable()
export class AIEscalationRequestedHandler implements OnModuleInit {
  constructor(
    @Inject(EVENT_BUS)
    private readonly eventBus: IEventBus,
    @Inject(CONVERSATION_REPOSITORY)
    private readonly conversationRepository: IConversationRepository,
    private readonly sendAiMessageUseCase: SendAIMessageUseCase,
    private readonly followUpService: FollowUpService,
  ) {}

  onModuleInit() {
    this.eventBus.subscribe(
      'ai.escalation-requested',
      async (event) => {
        await this.handle(event as AIEscalationRequestedIntegrationEvent);
      },
      { consumerName: 'messaging-ai-escalation-requested' },
    );
  }

  private async handle(event: AIEscalationRequestedIntegrationEvent) {
    const payload = event.payload as unknown as EscalationPayload;
    const conversation = await this.conversationRepository.findById(
      payload.conversationId,
    );

    if (!conversation) {
      return;
    }

    if (conversation.status !== 'PENDING_HUMAN') {
      conversation.markAsPendingHuman();
      await this.conversationRepository.save(conversation);
    }

    await this.followUpService.cancelFollowUps(
      payload.conversationId,
      'human-handoff',
    );

    if (payload.escalationMessage) {
      await this.sendAiMessageUseCase.execute({
        conversationId: payload.conversationId,
        text: payload.escalationMessage,
        type: 'TEXT',
      });
    }
  }
}
