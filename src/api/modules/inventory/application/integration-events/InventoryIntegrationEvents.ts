import { IntegrationEvent } from '@shared/application/ports/IntegrationEvent';

export class InventoryItemSyncedIntegrationEvent extends IntegrationEvent {
  readonly queue = 'inventory.item-synced';
  readonly sourceModule = 'inventory';
  readonly payload: Record<string, unknown>;

  get eventName(): string {
    return 'inventory.item.synced.v1';
  }

  get aggregateId(): string | undefined {
    return this.payload.itemId as string;
  }

  constructor(data: {
    itemId: string;
    tenantId: string;
    sku: string;
    name: string;
    availableQuantity: number;
    availabilityStatus: string;
    currentPrice: string | null;
    source: string;
  }) {
    super();
    this.payload = data;
  }
}

export class InventoryItemUnavailableIntegrationEvent extends IntegrationEvent {
  readonly queue = 'inventory.item-unavailable';
  readonly sourceModule = 'inventory';
  readonly payload: Record<string, unknown>;

  get eventName(): string {
    return 'inventory.item.unavailable.v1';
  }

  get aggregateId(): string | undefined {
    return this.payload.itemId as string;
  }

  constructor(data: {
    itemId: string;
    tenantId: string;
    sku: string;
    name: string;
  }) {
    super();
    this.payload = data;
  }
}

export class InventoryPriceChangedIntegrationEvent extends IntegrationEvent {
  readonly queue = 'inventory.price-changed';
  readonly sourceModule = 'inventory';
  readonly payload: Record<string, unknown>;

  get eventName(): string {
    return 'inventory.price.changed.v1';
  }

  get aggregateId(): string | undefined {
    return this.payload.itemId as string;
  }

  constructor(data: {
    itemId: string;
    tenantId: string;
    sku: string;
    previousPrice: string | null;
    newPrice: string | null;
  }) {
    super();
    this.payload = data;
  }
}

export class InventoryConnectionCreatedIntegrationEvent extends IntegrationEvent {
  readonly queue = 'inventory.connection-created';
  readonly sourceModule = 'inventory';
  readonly payload: Record<string, unknown>;

  get eventName(): string {
    return 'inventory.connection.created.v1';
  }

  get aggregateId(): string | undefined {
    return this.payload.connectionId as string;
  }

  constructor(data: {
    connectionId: string;
    tenantId: string;
    sourceType: string;
    providerName: string;
  }) {
    super();
    this.payload = data;
  }
}
