import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import {
  IEventBus,
  EVENT_BUS,
} from '@shared/application/ports/IEventBus';
import { TrackSalesMetricUseCase } from '../use-cases/TrackSalesMetricUseCase';

@Injectable()
export class SalesAnalyticsHandler implements OnModuleInit {
  constructor(
    @Inject(EVENT_BUS)
    private readonly eventBus: IEventBus,
    private readonly trackSalesMetricUseCase: TrackSalesMetricUseCase,
  ) {}

  onModuleInit() {
    this.eventBus.subscribe(
      'messaging.message-received',
      async (event: any) => {
        const payload = event.payload;
        await this.trackSalesMetricUseCase.execute({
          tenantId: payload.tenantId,
          type: 'MESSAGE',
        });
      },
      { consumerName: 'sales-message-received' },
    );

    this.eventBus.subscribe(
      'messaging.message-sent',
      async (event: any) => {
        const payload = event.payload;
        await this.trackSalesMetricUseCase.execute({
          tenantId: payload.tenantId,
          type: 'MESSAGE',
        });
      },
      { consumerName: 'sales-message-sent' },
    );

    this.eventBus.subscribe(
      'ai.lead-scored',
      async (event: any) => {
        const payload = event.payload;
        if (payload.intent === 'PURCHASE') {
          await this.trackSalesMetricUseCase.execute({
            tenantId: payload.tenantId,
            type: 'INTENT',
          });
        }
      },
      { consumerName: 'sales-ai-lead-scored' },
    );
  }
}
