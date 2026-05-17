import { IntegrationEvent } from '@shared/application/ports/IntegrationEvent';

export class CommerceSessionStartedIntegrationEvent extends IntegrationEvent {
  readonly queue = 'commerce.session.started';
  readonly sourceModule = 'commerce';
  readonly payload: Record<string, unknown>;

  get eventName(): string {
    return 'commerce.session.started.v1';
  }

  get aggregateId(): string | undefined {
    return this.payload.sessionId as string;
  }

  constructor(data: {
    sessionId: string;
    tenantId: string;
    conversationId: string;
    contactId?: string | null;
  }) {
    super();
    this.payload = data;
  }
}

export class CommerceSessionItemAddedIntegrationEvent extends IntegrationEvent {
  readonly queue = 'commerce.session.item-added';
  readonly sourceModule = 'commerce';
  readonly payload: Record<string, unknown>;

  get eventName(): string {
    return 'commerce.session.item-added.v1';
  }

  get aggregateId(): string | undefined {
    return this.payload.sessionId as string;
  }

  constructor(data: {
    tenantId: string;
    sessionId: string;
    conversationId: string;
    contactId?: string | null;
    itemName: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    subtotalAmount: number;
    totalAmount: number;
    source: 'INVENTORY' | 'CATALOG';
    inventoryItemId?: string | null;
    catalogItemId?: string | null;
  }) {
    super();
    this.payload = data;
  }
}

export class CommerceCheckoutCreatedIntegrationEvent extends IntegrationEvent {
  readonly queue = 'commerce.checkout.created';
  readonly sourceModule = 'commerce';
  readonly payload: Record<string, unknown>;

  get eventName(): string {
    return 'commerce.checkout.created.v1';
  }

  get aggregateId(): string | undefined {
    return this.payload.orderId as string;
  }

  constructor(data: {
    orderId: string;
    tenantId: string;
    sessionId: string;
    conversationId: string;
    contactId?: string | null;
    paymentReference?: string | null;
    paymentLinkId?: string | null;
    paymentLinkUrl?: string | null;
    fulfillmentType?: string | null;
    shippingMode?: string | null;
    subtotalAmount: number;
    freightAmount: number;
    totalAmount: number;
  }) {
    super();
    this.payload = data;
  }
}

export class CommerceOrderPaidIntegrationEvent extends IntegrationEvent {
  readonly queue = 'commerce.order.paid';
  readonly sourceModule = 'commerce';
  readonly payload: Record<string, unknown>;

  get eventName(): string {
    return 'commerce.order.paid.v1';
  }

  get aggregateId(): string | undefined {
    return this.payload.orderId as string;
  }

  constructor(data: {
    orderId: string;
    tenantId: string;
    paidAt: Date;
    totalAmount: number;
  }) {
    super();
    this.payload = data;
  }
}

export class CommerceOrderPreparingIntegrationEvent extends IntegrationEvent {
  readonly queue = 'commerce.order.preparing';
  readonly sourceModule = 'commerce';
  readonly payload: Record<string, unknown>;

  get eventName(): string {
    return 'commerce.order.preparing.v1';
  }

  get aggregateId(): string | undefined {
    return this.payload.orderId as string;
  }

  constructor(data: { orderId: string; tenantId: string }) {
    super();
    this.payload = data;
  }
}

export class CommerceOrderShippedIntegrationEvent extends IntegrationEvent {
  readonly queue = 'commerce.order.shipped';
  readonly sourceModule = 'commerce';
  readonly payload: Record<string, unknown>;

  get eventName(): string {
    return 'commerce.order.shipped.v1';
  }

  get aggregateId(): string | undefined {
    return this.payload.orderId as string;
  }

  constructor(data: { orderId: string; tenantId: string }) {
    super();
    this.payload = data;
  }
}

export class CommerceOrderReadyForPickupIntegrationEvent extends IntegrationEvent {
  readonly queue = 'commerce.order.ready-for-pickup';
  readonly sourceModule = 'commerce';
  readonly payload: Record<string, unknown>;

  get eventName(): string {
    return 'commerce.order.ready-for-pickup.v1';
  }

  get aggregateId(): string | undefined {
    return this.payload.orderId as string;
  }

  constructor(data: { orderId: string; tenantId: string }) {
    super();
    this.payload = data;
  }
}

export class CommerceOrderDeliveredIntegrationEvent extends IntegrationEvent {
  readonly queue = 'commerce.order.delivered';
  readonly sourceModule = 'commerce';
  readonly payload: Record<string, unknown>;

  get eventName(): string {
    return 'commerce.order.delivered.v1';
  }

  get aggregateId(): string | undefined {
    return this.payload.orderId as string;
  }

  constructor(data: { orderId: string; tenantId: string }) {
    super();
    this.payload = data;
  }
}

export class CommerceOrderCancelledIntegrationEvent extends IntegrationEvent {
  readonly queue = 'commerce.order.cancelled';
  readonly sourceModule = 'commerce';
  readonly payload: Record<string, unknown>;

  get eventName(): string {
    return 'commerce.order.cancelled.v1';
  }

  get aggregateId(): string | undefined {
    return this.payload.orderId as string;
  }

  constructor(data: { orderId: string; tenantId: string }) {
    super();
    this.payload = data;
  }
}

export class CommerceSessionAbandonedIntegrationEvent extends IntegrationEvent {
  readonly queue = 'commerce.session.abandoned';
  readonly sourceModule = 'commerce';
  readonly payload: Record<string, unknown>;

  get eventName(): string {
    return 'commerce.session.abandoned.v1';
  }

  get aggregateId(): string | undefined {
    return this.payload.sessionId as string;
  }

  constructor(data: {
    sessionId: string;
    tenantId: string;
    conversationId?: string;
    contactId?: string | null;
    interval?: string;
    subtotalAmount?: number;
    totalAmount?: number;
    currentStep?: string;
  }) {
    super();
    this.payload = data;
  }
}
