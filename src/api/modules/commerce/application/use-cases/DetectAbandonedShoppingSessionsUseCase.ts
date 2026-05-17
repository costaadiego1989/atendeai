import { Inject, Injectable } from '@nestjs/common';
import {
  COMMERCE_REPOSITORY,
  ICommerceRepository,
} from '../../domain/ports/ICommerceRepository';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import { CommerceSessionAbandonedIntegrationEvent } from '../integration-events/CheckoutIntegrationEvents';

export interface DetectAbandonedShoppingSessionsInput {
  now?: Date;
  limitPerInterval?: number;
}

@Injectable()
export class DetectAbandonedShoppingSessionsUseCase {
  private readonly intervals = [
    { name: '1h', delayMs: 1 * 60 * 60 * 1000 },
    { name: '1d', delayMs: 24 * 60 * 60 * 1000 },
    { name: '7d', delayMs: 7 * 24 * 60 * 60 * 1000 },
  ] as const;

  constructor(
    @Inject(COMMERCE_REPOSITORY)
    private readonly commerceRepository: ICommerceRepository,
    @Inject(EVENT_BUS)
    private readonly eventBus: IEventBus,
  ) {}

  async execute(input: DetectAbandonedShoppingSessionsInput = {}) {
    const now = input.now ?? new Date();
    const limit = input.limitPerInterval ?? 100;
    const triggered: Array<{
      sessionId: string;
      tenantId: string;
      interval: string;
    }> = [];

    for (const interval of this.intervals) {
      const staleBefore = new Date(now.getTime() - interval.delayMs);
      const sessions = await this.commerceRepository.listAbandonedSessions({
        interval: interval.name,
        staleBefore,
        limit,
      });

      for (const session of sessions) {
        await this.eventBus.publish(
          new CommerceSessionAbandonedIntegrationEvent({
            sessionId: session.id,
            tenantId: session.tenantId,
            conversationId: session.conversationId,
            contactId: session.contactId,
            interval: interval.name,
            subtotalAmount: session.subtotalAmount,
            totalAmount: session.totalAmount,
            currentStep: session.currentStep,
          }),
        );

        await this.commerceRepository.saveAuditLog({
          tenantId: session.tenantId,
          event: 'SESSION_ABANDONMENT_TRIGGERED',
          entityId: session.id,
          entityType: 'SESSION',
          metadata: {
            interval: interval.name,
            subtotalAmount: session.subtotalAmount,
            totalAmount: session.totalAmount,
            currentStep: session.currentStep,
            detectedAt: now.toISOString(),
          },
        });

        triggered.push({
          sessionId: session.id,
          tenantId: session.tenantId,
          interval: interval.name,
        });
      }
    }

    return {
      processedAt: now,
      triggered,
    };
  }
}
