import { IntegrationEvent } from '@shared/application/ports/IntegrationEvent';

export class SalesPaymentLinkCreatedIntegrationEvent extends IntegrationEvent {
  readonly queue = 'sales.payment-link-created';
  readonly sourceModule = 'sales';
  readonly payload: Record<string, unknown>;
  get eventName(): string {
    return 'sales.payment-link.created.v1';
  }
  get aggregateId(): string | undefined {
    return this.payload.paymentLinkId as string;
  }

  constructor(data: {
    tenantId: string;
    paymentLinkId: string;
    url: string;
    name: string;
    value: number;
    billingType: string;
    catalogItemId?: string | null;
    catalogItemSku?: string | null;
    catalogItemName?: string | null;
  }) {
    super();
    this.payload = data;
  }
}

/** Remarketing quando o gateway marca cobrança associada ao link como em atraso (sem máquina de estados PIX/boleto). */
export class SalesPaymentLinkOverdueRemarketingIntegrationEvent extends IntegrationEvent {
  readonly queue = 'sales.payment_link.overdue_remarketing';
  readonly sourceModule = 'sales';
  readonly payload: Record<string, unknown>;

  get aggregateId(): string | undefined {
    return this.payload.contactId as string;
  }

  constructor(data: {
    tenantId: string;
    contactId: string;
    contactName: string;
    branchId?: string | null;
    conversationId?: string | null;
    paymentLinkUrl: string;
    linkTitle: string;
    value: number;
  }) {
    super();
    this.payload = data;
  }
}

export class SalesPaymentConfirmedConversationIntegrationEvent extends IntegrationEvent {
  readonly queue = 'sales.payment_confirmed.conversation';
  readonly sourceModule = 'sales';
  readonly payload: Record<string, unknown>;

  get aggregateId(): string | undefined {
    return this.payload.contactId as string;
  }

  constructor(data: {
    tenantId: string;
    contactId: string;
    contactName: string;
    branchId?: string | null;
    conversationId?: string | null;
    paymentLinkUrl: string;
    linkTitle: string;
    value: number;
  }) {
    super();
    this.payload = data;
  }
}
