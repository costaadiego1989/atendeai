import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { PaymentWebhookProjectionInput } from './PaymentWebhookSchedulingProjectionService';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import { SalesPaymentLinkOverdueRemarketingIntegrationEvent } from '@modules/sales/application/integration-events/SalesIntegrationEvents';

@Injectable()
export class PaymentWebhookSalesProjectionService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(EVENT_BUS)
    private readonly eventBus: IEventBus,
  ) {}

  async project(input: PaymentWebhookProjectionInput): Promise<void> {
    if (!input.tenantId || !input.rawReference) {
      return;
    }

    const salesResourceMatch =
      /^(sales-link|sales-charge)\|([^|]+)\|([^|]+)$/.exec(input.rawReference);
    if (!salesResourceMatch || salesResourceMatch[2] !== input.tenantId) {
      return;
    }

    const status = this.resolveStatus(input.eventType);
    if (!status) {
      return;
    }

    await this.prisma.$executeRaw(Prisma.sql`
      ALTER TABLE sales_schema.payment_links
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    `);

    const rows = await this.prisma.$queryRaw<Record<string, unknown>[]>(Prisma.sql`
      UPDATE sales_schema.payment_links
      SET status = ${status}, updated_at = now()
      WHERE tenant_id = ${input.tenantId}::uuid
        AND external_id = ${input.rawReference}
      RETURNING id, tenant_id, branch_id, contact_id, conversation_id, url, name, value, external_id, status
    `);

    const updated = rows[0];
    if (
      !updated ||
      status !== 'OVERDUE' ||
      salesResourceMatch[1] !== 'sales-link'
    ) {
      return;
    }

    const contactId = updated.contact_id as string | null | undefined;
    if (!contactId) {
      return;
    }

    let contactName = 'Cliente';
    const contactRows = await this.prisma.$queryRaw<{ name: string }[]>(Prisma.sql`
      SELECT name FROM contact_schema.contacts
      WHERE tenant_id = ${input.tenantId}::uuid AND id = ${contactId}::uuid
      LIMIT 1
    `);
    if (contactRows[0]?.name) {
      contactName = String(contactRows[0].name);
    }

    await this.eventBus.publish(
      new SalesPaymentLinkOverdueRemarketingIntegrationEvent({
        tenantId: input.tenantId,
        contactId,
        contactName,
        branchId: (updated.branch_id as string | null | undefined) ?? null,
        conversationId: (updated.conversation_id as string | null | undefined) ?? null,
        paymentLinkUrl: String(updated.url ?? ''),
        linkTitle: String(updated.name ?? ''),
        value: Number(updated.value ?? 0),
      }),
    );
  }

  private resolveStatus(
    eventType: string,
  ): 'PAID' | 'OVERDUE' | 'REFUNDED' | undefined {
    const statusByEvent: Record<
      string,
      'PAID' | 'OVERDUE' | 'REFUNDED' | undefined
    > = {
      PAYMENT_CONFIRMED: 'PAID',
      PAYMENT_OVERDUE: 'OVERDUE',
      PAYMENT_REFUNDED: 'REFUNDED',
    };

    return statusByEvent[eventType];
  }
}
