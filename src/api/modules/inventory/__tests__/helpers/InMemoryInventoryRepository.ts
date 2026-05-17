import { randomUUID } from 'crypto';
import {
  IInventoryRepository,
  InventoryConnectionRecord,
  InventoryItemRecord,
  CreateInventoryConnectionInput,
  ListInventoryItemsFilters,
  SyncInventoryItemInput,
} from '../../domain/ports/IInventoryRepository';

export class InMemoryInventoryRepository implements IInventoryRepository {
  private items = new Map<string, InventoryItemRecord>();
  private connections = new Map<string, InventoryConnectionRecord>();

  clear(): void {
    this.items.clear();
    this.connections.clear();
  }

  async syncItem(input: SyncInventoryItemInput): Promise<InventoryItemRecord> {
    const key = `${input.tenantId}:${input.sku}`;
    const existing = this.items.get(key);
    const now = new Date();

    const record: InventoryItemRecord = {
      id: existing?.id ?? randomUUID(),
      tenantId: input.tenantId,
      catalogItemId: input.catalogItemId ?? null,
      sku: input.sku,
      externalReference: input.externalReference ?? null,
      name: input.name,
      availableQuantity: Math.max(0, input.availableQuantity),
      availabilityStatus: input.availabilityStatus,
      currentPrice: input.currentPrice ?? null,
      currency: input.currency ?? 'BRL',
      source: input.source ?? 'MANUAL',
      lastSyncedAt: now,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    this.items.set(key, record);
    return record;
  }

  async listItems(
    filters: ListInventoryItemsFilters,
  ): Promise<InventoryItemRecord[]> {
    return Array.from(this.items.values()).filter((item) => {
      if (item.tenantId !== filters.tenantId) return false;
      if (filters.availableOnly && item.availabilityStatus === 'UNAVAILABLE')
        return false;
      if (filters.query) {
        const q = filters.query.toLowerCase();
        return (
          item.name.toLowerCase().includes(q) ||
          item.sku.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }

  async findItemBySku(
    tenantId: string,
    sku: string,
  ): Promise<InventoryItemRecord | null> {
    return this.items.get(`${tenantId}:${sku}`) ?? null;
  }

  async createConnection(
    input: CreateInventoryConnectionInput,
  ): Promise<InventoryConnectionRecord> {
    const now = new Date();
    const record: InventoryConnectionRecord = {
      id: randomUUID(),
      tenantId: input.tenantId,
      sourceType: input.sourceType,
      providerName: input.providerName,
      status: 'ACTIVE',
      config: input.config ?? {},
      lastSyncedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.connections.set(record.id, record);
    return record;
  }

  async listConnections(
    tenantId: string,
  ): Promise<InventoryConnectionRecord[]> {
    return Array.from(this.connections.values()).filter(
      (c) => c.tenantId === tenantId,
    );
  }

  async findConnectionByProvider(
    tenantId: string,
    sourceType: string,
    providerName: string,
  ): Promise<InventoryConnectionRecord | null> {
    return (
      Array.from(this.connections.values()).find(
        (c) =>
          c.tenantId === tenantId &&
          c.sourceType === sourceType &&
          c.providerName === providerName,
      ) ?? null
    );
  }

  async markConnectionSyncedAt(
    connectionId: string,
    syncedAt: Date,
  ): Promise<void> {
    const conn = this.connections.get(connectionId);
    if (conn) {
      this.connections.set(connectionId, { ...conn, lastSyncedAt: syncedAt });
    }
  }
}
