import { IntegrationEvent } from '@shared/application/ports/IntegrationEvent';

export class TenantCreatedIntegrationEvent extends IntegrationEvent {
  readonly queue = 'tenant.created';
  readonly sourceModule = 'tenant';
  readonly payload: Record<string, unknown>;
  get eventName(): string {
    return 'tenant.tenant.created.v1';
  }
  get aggregateId(): string | undefined {
    return this.payload.aggregateId as string;
  }

  constructor(data: {
    aggregateId: string;
    companyName: string;
    cnpj: string;
    plan: string;
    ownerName: string;
    ownerEmail: string;
    ownerPhone: string;
    ownerPassword?: string;
    isTrial?: boolean;
  }) {
    super();
    this.payload = data;
  }
}

export class TenantUserCreatedIntegrationEvent extends IntegrationEvent {
  readonly queue = 'tenant.user-created';
  readonly sourceModule = 'tenant';
  readonly payload: Record<string, unknown>;
  get eventName(): string {
    return 'tenant.user.created.v1';
  }
  get aggregateId(): string | undefined {
    return this.payload.userId as string;
  }

  constructor(data: {
    userId: string;
    tenantId: string;
    name: string;
    email: string;
    phone: string;
    role: string;
  }) {
    super();
    this.payload = data;
  }
}

export class TenantWhatsAppConfiguredIntegrationEvent extends IntegrationEvent {
  readonly queue = 'tenant.whatsapp-configured';
  readonly sourceModule = 'tenant';
  readonly payload: Record<string, unknown>;
  get eventName(): string {
    return 'tenant.tenant.whatsapp-configured.v1';
  }
  get aggregateId(): string | undefined {
    return this.payload.aggregateId as string;
  }

  constructor(data: { aggregateId: string; whatsappNumber: string }) {
    super();
    this.payload = data;
  }
}

export class TenantInstagramConfiguredIntegrationEvent extends IntegrationEvent {
  readonly queue = 'tenant.instagram-configured';
  readonly sourceModule = 'tenant';
  readonly payload: Record<string, unknown>;
  get eventName(): string {
    return 'tenant.tenant.instagram-configured.v1';
  }
  get aggregateId(): string | undefined {
    return this.payload.aggregateId as string;
  }

  constructor(data: { aggregateId: string; instagramAccountId: string }) {
    super();
    this.payload = data;
  }
}

export class TenantAIConfigUpdatedIntegrationEvent extends IntegrationEvent {
  readonly queue = 'tenant.ai-config-updated';
  readonly sourceModule = 'tenant';
  readonly payload: Record<string, unknown>;
  get eventName(): string {
    return 'tenant.tenant.ai-config-updated.v1';
  }
  get aggregateId(): string | undefined {
    return this.payload.aggregateId as string;
  }

  constructor(data: { aggregateId: string }) {
    super();
    this.payload = data;
  }
}

export class TenantPlanChangedIntegrationEvent extends IntegrationEvent {
  readonly queue = 'tenant.plan-changed';
  readonly sourceModule = 'tenant';
  readonly payload: Record<string, unknown>;
  get eventName(): string {
    return 'tenant.tenant.plan-changed.v1';
  }
  get aggregateId(): string | undefined {
    return this.payload.aggregateId as string;
  }

  constructor(data: { aggregateId: string; oldPlan: string; newPlan: string }) {
    super();
    this.payload = data;
  }
}
