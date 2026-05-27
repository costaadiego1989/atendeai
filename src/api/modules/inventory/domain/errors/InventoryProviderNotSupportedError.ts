export class InventoryProviderNotSupportedError extends Error {
  constructor(sourceType: string) {
    super(`Inventory provider not supported: ${sourceType}`);
    this.name = 'InventoryProviderNotSupportedError';
  }
}
