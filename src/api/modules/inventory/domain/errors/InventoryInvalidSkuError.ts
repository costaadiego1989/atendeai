import { DomainException } from '@shared/domain/exceptions/DomainExceptions';

export class InventoryInvalidSkuError extends DomainException {
  constructor() {
    super(
      'O SKU é obrigatório e não pode estar vazio para sincronizar um item de inventário.',
      'INVENTORY_INVALID_SKU',
    );
  }
}
