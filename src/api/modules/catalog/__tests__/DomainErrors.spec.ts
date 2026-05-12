import { CatalogCategoryInUseError } from '../domain/errors/CatalogCategoryInUseError';
import { CatalogCategoryNotFoundError } from '../domain/errors/CatalogCategoryNotFoundError';
import { CatalogInvalidPriceError } from '../domain/errors/CatalogInvalidPriceError';
import { CatalogItemNotFoundError } from '../domain/errors/CatalogItemNotFoundError';
import { DomainException } from '@shared/domain/exceptions/DomainExceptions';

describe('Domain Errors', () => {
  describe('CatalogCategoryInUseError', () => {
    it('has correct message and code', () => {
      const error = new CatalogCategoryInUseError('cat-123');

      expect(error).toBeInstanceOf(DomainException);
      expect(error.message).toBe(
        'A categoria cat-123 não pode ser desativada pois possui itens vinculados.',
      );
      expect(error.code).toBe('CATALOG_CATEGORY_IN_USE');
      expect(error.name).toBe('CatalogCategoryInUseError');
    });
  });

  describe('CatalogCategoryNotFoundError', () => {
    it('has correct message and code', () => {
      const error = new CatalogCategoryNotFoundError('cat-456');

      expect(error).toBeInstanceOf(DomainException);
      expect(error.message).toBe(
        'Categoria de catálogo com ID cat-456 não encontrada.',
      );
      expect(error.code).toBe('CATALOG_CATEGORY_NOT_FOUND');
      expect(error.name).toBe('CatalogCategoryNotFoundError');
    });
  });

  describe('CatalogInvalidPriceError', () => {
    it('has correct message and code', () => {
      const error = new CatalogInvalidPriceError(-10);

      expect(error).toBeInstanceOf(DomainException);
      expect(error.message).toBe('O preço informado (-10) é inválido.');
      expect(error.code).toBe('CATALOG_INVALID_PRICE');
      expect(error.name).toBe('CatalogInvalidPriceError');
    });
  });

  describe('CatalogItemNotFoundError', () => {
    it('has correct message and code', () => {
      const error = new CatalogItemNotFoundError('item-789');

      expect(error).toBeInstanceOf(DomainException);
      expect(error.message).toBe(
        'Item do catálogo com ID item-789 não encontrado.',
      );
      expect(error.code).toBe('CATALOG_ITEM_NOT_FOUND');
      expect(error.name).toBe('CatalogItemNotFoundError');
    });
  });
});
