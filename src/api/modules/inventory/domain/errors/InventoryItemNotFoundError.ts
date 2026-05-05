import { DomainException } from '@shared/domain/exceptions/DomainExceptions';

export class InventoryItemNotFoundError extends DomainException {
  constructor(id: string) {
    super(
      `Item de inventário com ID ${id} não encontrado.`,
      'INVENTORY_ITEM_NOT_FOUND',
    );
  }
}
