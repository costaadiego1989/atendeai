export interface InventoryItemSnapshot {
  sku: string;
  externalReference?: string;
  name: string;
  availableQuantity: number;
  availabilityStatus: 'AVAILABLE' | 'LOW_STOCK' | 'UNAVAILABLE' | 'RESERVED';
  currentPrice?: string;
  currency?: string;
}

export interface IInventoryProvider {
  testConnection(config: Record<string, unknown>): Promise<boolean>;
  fetchStock(
    config: Record<string, unknown>,
    lastSyncAt?: Date,
  ): AsyncGenerator<InventoryItemSnapshot[]>;
}

export const INVENTORY_PROVIDER_FACTORY = Symbol('INVENTORY_PROVIDER_FACTORY');

export interface IInventoryProviderFactory {
  getProvider(sourceType: string): IInventoryProvider;
}
