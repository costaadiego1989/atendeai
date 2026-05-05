import { DomainException } from '@shared/domain/exceptions/DomainExceptions';

export class CatalogCategoryInUseError extends DomainException {
  constructor(categoryId: string) {
    super(`A categoria ${categoryId} não pode ser desativada pois possui itens vinculados.`, 'CATALOG_CATEGORY_IN_USE');
  }
}
