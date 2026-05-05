import { IntegrationEvent } from '@shared/application/ports/IntegrationEvent';

export class CatalogItemCreatedIntegrationEvent extends IntegrationEvent {
  readonly queue = 'catalog.item-created';
  readonly sourceModule = 'catalog';
  readonly payload: Record<string, unknown>;

  get eventName(): string {
    return 'catalog.item.created.v1';
  }

  get aggregateId(): string | undefined {
    return this.payload.itemId as string;
  }

  constructor(data: {
    itemId: string;
    tenantId: string;
    name: string;
    type: string;
    basePrice: string | null;
  }) {
    super();
    this.payload = data;
  }
}

export class CatalogItemUpdatedIntegrationEvent extends IntegrationEvent {
  readonly queue = 'catalog.item-updated';
  readonly sourceModule = 'catalog';
  readonly payload: Record<string, unknown>;

  get eventName(): string {
    return 'catalog.item.updated.v1';
  }

  get aggregateId(): string | undefined {
    return this.payload.itemId as string;
  }

  constructor(data: {
    itemId: string;
    tenantId: string;
    name: string;
    basePrice: string | null;
    active: boolean;
  }) {
    super();
    this.payload = data;
  }
}

export class CatalogItemDeactivatedIntegrationEvent extends IntegrationEvent {
  readonly queue = 'catalog.item-deactivated';
  readonly sourceModule = 'catalog';
  readonly payload: Record<string, unknown>;

  get eventName(): string {
    return 'catalog.item.deactivated.v1';
  }

  get aggregateId(): string | undefined {
    return this.payload.itemId as string;
  }

  constructor(data: { itemId: string; tenantId: string }) {
    super();
    this.payload = data;
  }
}

export class CatalogCategoryDeactivatedIntegrationEvent extends IntegrationEvent {
  readonly queue = 'catalog.category-deactivated';
  readonly sourceModule = 'catalog';
  readonly payload: Record<string, unknown>;

  get eventName(): string {
    return 'catalog.category.deactivated.v1';
  }

  get aggregateId(): string | undefined {
    return this.payload.categoryId as string;
  }

  constructor(data: { categoryId: string; tenantId: string }) {
    super();
    this.payload = data;
  }
}
