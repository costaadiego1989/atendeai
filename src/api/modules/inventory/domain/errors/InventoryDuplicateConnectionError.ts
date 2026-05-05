import { DomainException } from '@shared/domain/exceptions/DomainExceptions';

export class InventoryDuplicateConnectionError extends DomainException {
  constructor(providerName: string, sourceType: string) {
    super(
      `Já existe uma conexão do tipo ${sourceType} com o provedor "${providerName}" para este tenant.`,
      'INVENTORY_DUPLICATE_CONNECTION',
    );
  }
}
