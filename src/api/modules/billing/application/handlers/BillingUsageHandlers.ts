import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import {
  IRecordUsageUseCase,
  UsageType,
} from '../use-cases/interfaces/IRecordUsageUseCase';
import { toBillableAiTokens } from '../../domain/constants/AiTokenBillingPolicy';

interface MessageSentPayload {
  tenantId: string;
  conversationId: string;
  contactId: string;
}

interface AIResponsePayload {
  tenantId: string;
  tokensUsed: number;
}

@Injectable()
export class BillingUsageHandlers implements OnModuleInit {
  constructor(
    @Inject(EVENT_BUS)
    private readonly eventBus: IEventBus,
    @Inject(IRecordUsageUseCase)
    private readonly recordUsageUseCase: IRecordUsageUseCase,
  ) { }

  onModuleInit() {
    this.eventBus.subscribe('messaging.message-sent', async (event) => {
      const payload = event.payload as unknown as MessageSentPayload;
      await this.recordUsageUseCase.execute({
        tenantId: payload.tenantId,
        type: UsageType.MESSAGE,
      });
    }, { consumerName: 'billing-message-sent' });

    this.eventBus.subscribe('ai.response-generated', async (event) => {
      const payload = event.payload as unknown as AIResponsePayload;
      await this.recordUsageUseCase.execute({
        tenantId: payload.tenantId,
        type: UsageType.AI_TOKEN,
        amount: toBillableAiTokens(payload.tokensUsed),
      });
    }, { consumerName: 'billing-ai-response-generated' });
  }
}
