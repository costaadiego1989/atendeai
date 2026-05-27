/**
 * Port for inventory synchronization.
 * Defined in the catalog module to decouple from inventory internals.
 */
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

export interface IInventorySyncPort {
  syncItem(input: SyncInventoryItemInput): Promise<void>;
}

export const INVENTORY_SYNC_PORT = Symbol('INVENTORY_SYNC_PORT');
