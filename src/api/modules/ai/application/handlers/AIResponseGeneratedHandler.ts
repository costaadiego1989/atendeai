import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import {
  IEventBus,
  EVENT_BUS,
} from '../../../../shared/infrastructure/event-bus';
import {
  AIResponseGeneratedIntegrationEvent,
  LeadScoredIntegrationEvent,
} from '../integration-events/publishers/AIIntegrationEvents';
import {
  LeadScoringService,
  IntentType,
  SentimentType,
} from '../../domain/services/LeadScoringService';

@Injectable()
export class AIResponseGeneratedHandler implements OnModuleInit {
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
    const payload = event.payload as any;

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
      console.log(
        `🔥 [HOT LEAD DETECTED] Tenant: ${payload.tenantId}, Contact: ${payload.contactId}, Score: ${score}`,
      );
    }
  }
}
