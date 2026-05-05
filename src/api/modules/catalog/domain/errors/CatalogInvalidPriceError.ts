import { DomainException } from '@shared/domain/exceptions/DomainExceptions';

export class CatalogInvalidPriceError extends DomainException {
  constructor(price: number) {
    super(`O preço informado (${price}) é inválido.`, 'CATALOG_INVALID_PRICE');
  }
}
