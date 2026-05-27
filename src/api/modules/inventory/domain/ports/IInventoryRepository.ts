export interface InventoryItemRecord {
  id: string;
  tenantId: string;
  catalogItemId?: string | null;
  sku: string;
  externalReference?: string | null;
  name: string;
  availableQuantity: number;
  availabilityStatus: string;
  currentPrice?: string | null;
  currency: string;
  source: string;
  lastSyncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface InventoryConnectionRecord {
  id: string;
  tenantId: string;
  sourceType: string;
  providerName: string;
  status: string;
  config: Record<string, unknown>;
  configSummary?: string;
  lastSyncedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SyncInventoryItemInput {
  tenantId: string;
  catalogItemId?: string;
  sku: string;
  externalReference?: string;
  name: string;
  availableQuantity: number;
  availabilityStatus: string;
  currentPrice?: string;
  currency?: string;
  source?: string;
}

export interface ListInventoryItemsFilters {
  tenantId: string;
  query?: string;
  availableOnly?: boolean;
}

export interface CreateInventoryConnectionInput {
  tenantId: string;
  sourceType: string;
  providerName: string;
  status?: string;
  config?: Record<string, unknown>;
}

export interface IInventoryRepository {
  syncItem(input: SyncInventoryItemInput): Promise<InventoryItemRecord>;
  listItems(filters: ListInventoryItemsFilters): Promise<InventoryItemRecord[]>;
  findItemBySku(
    tenantId: string,
    sku: string,
  ): Promise<InventoryItemRecord | null>;
  createConnection(
    input: CreateInventoryConnectionInput,
  ): Promise<InventoryConnectionRecord>;
  listConnections(tenantId: string): Promise<InventoryConnectionRecord[]>;
  getConnection(
    tenantId: string,
    id: string,
  ): Promise<InventoryConnectionRecord | null>;
  findConnectionByProvider(
    tenantId: string,
    sourceType: string,
    providerName: string,
  ): Promise<InventoryConnectionRecord | null>;
  markConnectionSyncedAt(
    tenantId: string,
    connectionId: string,
    syncedAt: Date,
  ): Promise<void>;
}

export const INVENTORY_REPOSITORY = Symbol('INVENTORY_REPOSITORY');
