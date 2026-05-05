import { Inject, Injectable } from '@nestjs/common';
import {
  IPaymentGateway,
  IPAYMENT_GATEWAY,
} from '../../domain/ports/IPaymentGateway';
import {
  PaymentConfirmedIntegrationEvent,
  PaymentOverdueIntegrationEvent,
  PaymentRefundedIntegrationEvent,
} from '../integration-events/PaymentIntegrationEvents';
import { PaymentWebhookSalesProjectionService } from '../services/PaymentWebhookSalesProjectionService';
import { PaymentWebhookSchedulingProjectionService } from '../services/PaymentWebhookSchedulingProjectionService';
import { TrialPaymentProjectionService } from '../services/TrialPaymentProjectionService';
import { PrismaPaymentWebhookReceiptStore } from '../../infrastructure/persistence/PrismaPaymentWebhookReceiptStore';
import { PrismaTransactionalEventPublisher } from '@shared/infrastructure/event-bus/PrismaTransactionalEventPublisher';

@Injectable()
export class ProcessWebhookUseCase {
  constructor(
    @Inject(IPAYMENT_GATEWAY)
    private readonly paymentGateway: IPaymentGateway,
    private readonly webhookReceiptStore: PrismaPaymentWebhookReceiptStore,
    private readonly transactionalEventPublisher: PrismaTransactionalEventPublisher,
    private readonly schedulingProjection: PaymentWebhookSchedulingProjectionService,
    private readonly salesProjection: PaymentWebhookSalesProjectionService,
    private readonly trialProjection: TrialPaymentProjectionService,
  ) {}

  async execute(rawPayload: any, signature?: string): Promise<void> {
    const parsedEvent = this.paymentGateway.parseWebhook(rawPayload, signature);

    if (!parsedEvent) {
      return;
    }

    const {
      eventType,
      paymentId,
      tenantId,
      amount,
      provider,
      occurredAt,
      rawReference,
    } = parsedEvent;
    const eventId = `payment:${provider}:${eventType}:${paymentId}`;
    const effectiveOccurredAt = occurredAt ?? new Date();

    await this.transactionalEventPublisher.execute(async (tx) => {
      const receipt = await this.webhookReceiptStore.registerReceived(
        parsedEvent,
        signature,
        tx,
      );

      if (!receipt.isNew) {
        return { result: undefined, events: [] };
      }

      if (!tenantId && !rawReference?.startsWith('trial|')) {
        await this.webhookReceiptStore.markIgnored(
          receipt.id,
          'TENANT_ID_MISSING',
          tx,
        );
        return { result: undefined, events: [] };
      }

      if (!tenantId) {
        await this.webhookReceiptStore.markProcessed(receipt.id, tx);
        return { result: undefined, events: [] };
      }

      switch (eventType) {
        case 'PAYMENT_CONFIRMED': {
          const event = new PaymentConfirmedIntegrationEvent(
            {
              tenantId,
              paymentId,
              amount: amount || 0,
              provider,
              rawReference,
              occurredAt: effectiveOccurredAt,
              confirmedAt: effectiveOccurredAt,
            },
            eventId,
          );
          await this.webhookReceiptStore.markProcessed(receipt.id, tx);
          return { result: undefined, events: [event] };
        }

        case 'PAYMENT_OVERDUE':
        case 'SUBSCRIPTION_DELETED': {
          const event = new PaymentOverdueIntegrationEvent(
            {
              tenantId,
              paymentId,
              amount,
              provider,
              rawReference,
              occurredAt: effectiveOccurredAt,
              overdueAt: effectiveOccurredAt,
            },
            eventId,
          );
          await this.webhookReceiptStore.markProcessed(receipt.id, tx);
          return { result: undefined, events: [event] };
        }

        case 'PAYMENT_REFUNDED': {
          const event = new PaymentRefundedIntegrationEvent(
            {
              tenantId,
              paymentId,
              amount,
              provider,
              rawReference,
              occurredAt: effectiveOccurredAt,
              refundedAt: effectiveOccurredAt,
            },
            eventId,
          );
          await this.webhookReceiptStore.markProcessed(receipt.id, tx);
          return { result: undefined, events: [event] };
        }

        default:
          await this.webhookReceiptStore.markIgnored(
            receipt.id,
            'UNSUPPORTED_EVENT',
            tx,
          );
          return { result: undefined, events: [] };
      }
    });

    await this.trialProjection.project({
      eventType,
      rawReference,
    });

    const projectionInput = {
      eventType,
      tenantId,
      rawReference,
      occurredAt: effectiveOccurredAt,
    };
    await this.schedulingProjection.project(projectionInput);
    await this.salesProjection.project(projectionInput);
  }
}
