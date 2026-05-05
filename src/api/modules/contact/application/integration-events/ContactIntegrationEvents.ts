import { IntegrationEvent } from '@shared/application/ports/IntegrationEvent';

export class ContactCreatedIntegrationEvent extends IntegrationEvent {
  readonly queue = 'contact.created';
  readonly sourceModule = 'contact';
  readonly payload: Record<string, unknown>;
  get eventName(): string {
    return 'contact.contact.created.v1';
  }
  get aggregateId(): string | undefined {
    return this.payload.contactId as string;
  }

  constructor(data: {
    contactId: string;
    tenantId: string;
    name: string;
    phone: string;
    email?: string;
    stage: string;
  }) {
    super();
    this.payload = data;
  }
}

export class ContactUpdatedIntegrationEvent extends IntegrationEvent {
  readonly queue = 'contact.updated';
  readonly sourceModule = 'contact';
  readonly payload: Record<string, unknown>;
  get eventName(): string {
    return 'contact.contact.updated.v1';
  }
  get aggregateId(): string | undefined {
    return this.payload.contactId as string;
  }

  constructor(data: {
    contactId: string;
    tenantId: string;
    name: string;
    phone: string;
    email?: string;
    tags: string[];
    notes?: string;
    stage: string;
  }) {
    super();
    this.payload = data;
  }
}

export class ContactStageChangedIntegrationEvent extends IntegrationEvent {
  readonly queue = 'contact.stage-changed';
  readonly sourceModule = 'contact';
  readonly payload: Record<string, unknown>;
  get eventName(): string {
    return 'contact.contact.stage-changed.v1';
  }
  get aggregateId(): string | undefined {
    return this.payload.contactId as string;
  }

  constructor(data: {
    contactId: string;
    tenantId: string;
    previousStage: string;
    newStage: string;
    changedAt: string;
  }) {
    super();
    this.payload = data;
  }
}

export class ContactInteractionRecordedIntegrationEvent extends IntegrationEvent {
  readonly queue = 'contact.interaction-recorded';
  readonly sourceModule = 'contact';
  readonly payload: Record<string, unknown>;
  get eventName(): string {
    return 'contact.contact.interaction-recorded.v1';
  }
  get aggregateId(): string | undefined {
    return this.payload.contactId as string;
  }

  constructor(data: {
    contactId: string;
    tenantId: string;
    lastInteraction: string;
  }) {
    super();
    this.payload = data;
  }
}

export class ContactDeletedIntegrationEvent extends IntegrationEvent {
  readonly queue = 'contact.deleted';
  readonly sourceModule = 'contact';
  readonly payload: Record<string, unknown>;
  get eventName(): string {
    return 'contact.contact.deleted.v1';
  }
  get aggregateId(): string | undefined {
    return this.payload.contactId as string;
  }

  constructor(data: {
    contactId: string;
    tenantId: string;
    phone: string;
    stage: string;
  }) {
    super();
    this.payload = data;
  }
}
