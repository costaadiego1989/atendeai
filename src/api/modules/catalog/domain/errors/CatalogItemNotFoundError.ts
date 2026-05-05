import { DomainException } from '@shared/domain/exceptions/DomainExceptions';

export class CatalogItemNotFoundError extends DomainException {
  constructor(id: string) {
    super(`Item do catálogo com ID ${id} não encontrado.`, 'CATALOG_ITEM_NOT_FOUND');
  }
}
