import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { IEventBus, EVENT_BUS } from '@shared/application/ports/IEventBus';
import { PaymentConfirmedIntegrationEvent } from '@modules/payment/application/integration-events/PaymentIntegrationEvents';
import { PaymentOverdueIntegrationEvent } from '@modules/payment/application/integration-events/PaymentIntegrationEvents';
import { PaymentRefundedIntegrationEvent } from '@modules/payment/application/integration-events/PaymentIntegrationEvents';
import {
  ISalesPaymentLinksRepository,
  SALES_PAYMENT_LINKS_REPOSITORY,
} from '../../domain/repositories/ISalesRepository';
import {
  SalesPaymentConfirmedConversationIntegrationEvent,
  SalesPaymentLinkOverdueRemarketingIntegrationEvent,
} from '../integration-events/SalesIntegrationEvents';

@Injectable()
export class SalesPaymentEventHandler implements OnModuleInit {
  private readonly logger = new Logger(SalesPaymentEventHandler.name);

  constructor(
    @Inject(EVENT_BUS)
    private readonly eventBus: IEventBus,
    @Inject(SALES_PAYMENT_LINKS_REPOSITORY)
    private readonly salesPaymentLinksRepository: ISalesPaymentLinksRepository,
  ) {}

  onModuleInit() {
    this.eventBus.subscribe(
      'payment.confirmed',
      async (event) => {
        const payload =
          event.payload as PaymentConfirmedIntegrationEvent['payload'];
        await this.handlePaymentEvent(
          payload.tenantId,
          payload.rawReference,
          'PAID',
        );
      },
      { consumerName: 'sales-payment-confirmed' },
    );

    this.eventBus.subscribe(
      'payment.overdue',
      async (event) => {
        const payload =
          event.payload as PaymentOverdueIntegrationEvent['payload'];
        await this.handlePaymentEvent(
          payload.tenantId,
          payload.rawReference,
          'OVERDUE',
        );
      },
      { consumerName: 'sales-payment-overdue' },
    );

    this.eventBus.subscribe(
      'payment.refunded',
      async (event) => {
        const payload =
          event.payload as PaymentRefundedIntegrationEvent['payload'];
        await this.handlePaymentEvent(
          payload.tenantId,
          payload.rawReference,
          'REFUNDED',
        );
      },
      { consumerName: 'sales-payment-refunded' },
    );
  }

  private async handlePaymentEvent(
    tenantId: string | undefined,
    rawReference: string | undefined,
    status: 'PAID' | 'OVERDUE' | 'REFUNDED',
  ): Promise<void> {
    if (!tenantId || !rawReference) {
      return;
    }

    const salesResourceMatch =
      /^(sales-link|sales-charge)\|([^|]+)\|([^|]+)$/.exec(rawReference);
    if (!salesResourceMatch || salesResourceMatch[2] !== tenantId) {
      return;
    }

    const resourceType = salesResourceMatch[1];

    const updated =
      await this.salesPaymentLinksRepository.updatePaymentLinkStatusByExternalReference(
        tenantId,
        rawReference,
        status,
      );

    if (!updated) {
      this.logger.warn(
        `Sales payment link not found for reference: ${rawReference}`,
      );
      return;
    }

    const contactId = updated.contactId;
    if (!contactId) {
      return;
    }

    const contactName =
      (await this.salesPaymentLinksRepository.findContactNameById(
        tenantId,
        contactId,
      )) ?? 'Cliente';

    const payload = {
      tenantId,
      contactId,
      contactName,
      branchId: updated.branchId ?? null,
      conversationId: updated.conversationId ?? null,
      paymentLinkUrl: updated.url ?? '',
      linkTitle: updated.name ?? '',
      value: updated.value ?? 0,
    };

    if (status === 'PAID') {
      await this.eventBus.publish(
        new SalesPaymentConfirmedConversationIntegrationEvent(payload),
      );
      return;
    }

    if (status === 'OVERDUE' && resourceType === 'sales-link') {
      await this.eventBus.publish(
        new SalesPaymentLinkOverdueRemarketingIntegrationEvent(payload),
      );
    }
  }
}
