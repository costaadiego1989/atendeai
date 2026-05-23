import { Inject, Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { IEventBus, EVENT_BUS } from '@shared/infrastructure/event-bus';
import { SendAIMessageUseCase } from '../use-cases/SendAIMessageUseCase';
import { AIResponseGeneratedIntegrationEvent } from '@modules/ai/application/integration-events/publishers/AIIntegrationEvents';
import { FollowUpService } from '../services/FollowUpService';

@Injectable()
export class AIResponseGeneratedHandler implements OnModuleInit {
  private readonly logger = new Logger(AIResponseGeneratedHandler.name);

  constructor(
    @Inject(EVENT_BUS)
    private readonly eventBus: IEventBus,
    private readonly sendAiMessageUseCase: SendAIMessageUseCase,
    private readonly followUpService: FollowUpService,
  ) {}

  onModuleInit() {
    this.eventBus.subscribe(
      'ai.response-generated',
      async (event) => {
        await this.handle(
          event as unknown as AIResponseGeneratedIntegrationEvent,
        );
      },
      { consumerName: 'messaging-ai-response-generated' },
    );

    this.eventBus.subscribe(
      'ai.response-failed',
      async (event) => {
        await this.handleFailed(event);
      },
      { consumerName: 'messaging-ai-response-failed' },
    );
  }

  private async handleFailed(event: any) {
    const data = event.payload || event;
    const fallback = data.fallbackMessage as string | undefined;
    const conversationId = data.conversationId as string | undefined;
    if (!fallback || !conversationId) return;

    try {
      await this.sendAiMessageUseCase.execute({
        conversationId,
        text: fallback,
        type: 'TEXT',
      });
    } catch (err) {
      this.logger.warn(
        `Failed to persist fallback AI message for conversation [${conversationId}]: ${(err as Error).message}`,
      );
    }
  }

  private async handle(event: AIResponseGeneratedIntegrationEvent) {
    const data = (event as any).payload || event;

    this.logger.log(
      `Handling AI Response for conversation [${data.conversationId}]`,
    );

    await this.sendAiMessageUseCase.execute({
      conversationId: data.conversationId,
      text: data.response?.text || '',
      type: data.response?.type || 'TEXT',
    });

    await this.followUpService.scheduleFollowUps(
      data.conversationId,
      data.tenantId,
      data.contactId,
    );
  }
}
