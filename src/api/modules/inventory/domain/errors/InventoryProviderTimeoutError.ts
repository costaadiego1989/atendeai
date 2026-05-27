export class InventoryProviderTimeoutError extends Error {
  constructor(provider: string) {
    super(`Inventory provider request timed out: ${provider}`);
    this.name = 'InventoryProviderTimeoutError';
  }
}
