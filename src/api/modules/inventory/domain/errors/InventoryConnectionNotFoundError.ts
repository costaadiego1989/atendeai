import { DomainException } from '@shared/domain/exceptions/DomainExceptions';

export class InventoryConnectionNotFoundError extends DomainException {
  constructor(id: string) {
    super(
      `Conexão de inventário com ID ${id} não encontrada.`,
      'INVENTORY_CONNECTION_NOT_FOUND',
    );
  }
}
