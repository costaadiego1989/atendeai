import { DomainException } from '@shared/domain/exceptions/DomainExceptions';

export class CatalogCategoryNotFoundError extends DomainException {
  constructor(id: string) {
    super(`Categoria de catálogo com ID ${id} não encontrada.`, 'CATALOG_CATEGORY_NOT_FOUND');
  }
}
