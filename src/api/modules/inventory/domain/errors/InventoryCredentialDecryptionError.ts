export class InventoryCredentialDecryptionError extends Error {
  constructor(connectionId: string) {
    super(`Failed to decrypt credential for connection ${connectionId}`);
    this.name = 'InventoryCredentialDecryptionError';
  }
}
