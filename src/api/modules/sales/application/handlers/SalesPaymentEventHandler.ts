import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { IEventBus, EVENT_BUS } from '@shared/application/ports/IEventBus';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { PaymentConfirmedIntegrationEvent } from '@modules/payment/application/integration-events/PaymentIntegrationEvents';
import { PaymentOverdueIntegrationEvent } from '@modules/payment/application/integration-events/PaymentIntegrationEvents';
import { PaymentRefundedIntegrationEvent } from '@modules/payment/application/integration-events/PaymentIntegrationEvents';
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
    private readonly prisma: PrismaService,
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

    const rows = await this.prisma.$queryRaw<
      Record<string, unknown>[]
    >(Prisma.sql`
      UPDATE sales_schema.payment_links
      SET status = ${status}, updated_at = now()
      WHERE tenant_id = ${tenantId}::uuid
        AND external_id = ${rawReference}
      RETURNING id, tenant_id, branch_id, contact_id, conversation_id, url, name, value, external_id, status
    `);

    const updated = rows[0];
    if (!updated) {
      this.logger.warn(
        `Sales payment link not found for reference: ${rawReference}`,
      );
      return;
    }

    const contactId = updated.contact_id as string | null | undefined;
    if (!contactId) {
      return;
    }

    let contactName = 'Cliente';
    const contactRows = await this.prisma.$queryRaw<
      { name: string }[]
    >(Prisma.sql`
      SELECT name FROM contact_schema.contacts
      WHERE tenant_id = ${tenantId}::uuid AND id = ${contactId}::uuid
      LIMIT 1
    `);
    if (contactRows[0]?.name) {
      contactName = String(contactRows[0].name);
    }

    const payload = {
      tenantId,
      contactId,
      contactName,
      branchId: (updated.branch_id as string | null | undefined) ?? null,
      conversationId:
        (updated.conversation_id as string | null | undefined) ?? null,
      paymentLinkUrl: String(updated.url ?? ''),
      linkTitle: String(updated.name ?? ''),
      value: Number(updated.value ?? 0),
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
