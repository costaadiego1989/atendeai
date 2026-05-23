import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  IEventBus,
  EVENT_BUS,
} from '../../../../shared/infrastructure/event-bus';
import {
  AIResponseGeneratedIntegrationEvent,
  AIResponseGeneratedPayload,
  LeadScoredIntegrationEvent,
} from '../integration-events/publishers/AIIntegrationEvents';
import {
  LeadScoringService,
  IntentType,
  SentimentType,
} from '../../domain/services/LeadScoringService';

@Injectable()
export class AIResponseGeneratedHandler implements OnModuleInit {
  private readonly logger = new Logger(AIResponseGeneratedHandler.name);

  constructor(
    @Inject(EVENT_BUS)
    private readonly eventBus: IEventBus,
    private readonly leadScoringService: LeadScoringService,
  ) {}

  onModuleInit() {
    this.eventBus.subscribe(
      'ai.response-generated',
      async (event: AIResponseGeneratedIntegrationEvent) => {
        await this.handle(event);
      },
      { consumerName: 'ai-lead-scoring' },
    );
  }

  private async handle(event: AIResponseGeneratedIntegrationEvent) {
    const payload = event.payload;

    if (!this.isValidPayload(payload)) {
      this.logger.warn(
        `ai_response_generated_invalid_payload conversation=${String(
          (payload as Partial<AIResponseGeneratedPayload>)?.conversationId,
        )}`,
      );
      return;
    }

    const score = this.leadScoringService.calculateScore(
      payload.intent as IntentType,
      payload.sentiment as SentimentType,
      payload.confidence,
    );

    const isHot = this.leadScoringService.isHotLead(score);

    await this.eventBus.publish(
      new LeadScoredIntegrationEvent({
        conversationId: payload.conversationId,
        tenantId: payload.tenantId,
        contactId: payload.contactId,
        score,
        isHot,
        intent: payload.intent,
        sentiment: payload.sentiment,
      }),
    );

    if (isHot) {
      this.logger.log(
        `hot_lead_detected tenant=${payload.tenantId} contact=${payload.contactId} conversation=${payload.conversationId} score=${score} intent=${payload.intent} sentiment=${payload.sentiment}`,
      );
    }
  }

  private isValidPayload(
    payload: AIResponseGeneratedPayload,
  ): payload is AIResponseGeneratedPayload {
    return (
      typeof payload?.tenantId === 'string' &&
      payload.tenantId.length > 0 &&
      typeof payload.conversationId === 'string' &&
      payload.conversationId.length > 0 &&
      typeof payload.contactId === 'string' &&
      payload.contactId.length > 0
    );
  }
}
