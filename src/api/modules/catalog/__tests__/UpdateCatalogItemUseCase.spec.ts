import { UpdateCatalogItemUseCase } from '../application/use-cases/UpdateCatalogItemUseCase';
import { CatalogItemNotFoundError } from '../domain/errors/CatalogItemNotFoundError';
import { CatalogCategoryNotFoundError } from '../domain/errors/CatalogCategoryNotFoundError';
import { CatalogItemUpdatedIntegrationEvent } from '../application/integration-events/CatalogIntegrationEvents';
import { CatalogItemRecord } from '../domain/ports/ICatalogRepository';

describe('UpdateCatalogItemUseCase', () => {
  const itemRecord = (
    overrides: Partial<CatalogItemRecord> = {},
  ): CatalogItemRecord => ({
    id: 'item-1',
    tenantId: 'tenant-1',
    categoryId: 'category-1',
    categoryName: 'Produtos',
    type: 'PRODUCT',
    name: 'Produto atual',
    description: null,
    basePrice: '10.00',
    currency: 'BRL',
    tags: [],
    active: true,
    source: 'MANUAL',
    externalReference: 'SKU-1',
    imageUrl: null,
    attributes: {},
    variants: [],
    optionGroups: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  let repository: any;
  let eventBus: any;
  let sut: UpdateCatalogItemUseCase;

  beforeEach(() => {
    repository = {
      findItemById: jest.fn(),
      findCategoryById: jest.fn(),
      updateItem: jest.fn(),
      saveAuditLog: jest.fn(),
    };
    eventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
    };
    sut = new UpdateCatalogItemUseCase(repository, eventBus);
  });

  it('CAT-T-031: missing item throws CatalogItemNotFoundError and does not publish', async () => {
    repository.findItemById.mockResolvedValue(null);

    await expect(
      sut.execute({
        tenantId: 'tenant-1',
        itemId: 'missing-item',
        type: 'PRODUCT',
        name: 'Produto',
      }),
    ).rejects.toBeInstanceOf(CatalogItemNotFoundError);

    expect(repository.updateItem).not.toHaveBeenCalled();
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it('CAT-T-032: inactive target category throws CatalogCategoryNotFoundError', async () => {
    repository.findItemById.mockResolvedValue(itemRecord());
    repository.findCategoryById.mockResolvedValue({
      id: 'category-inactive',
      active: false,
    });

    await expect(
      sut.execute({
        tenantId: 'tenant-1',
        itemId: 'item-1',
        categoryId: 'category-inactive',
        type: 'PRODUCT',
        name: 'Produto',
      }),
    ).rejects.toBeInstanceOf(CatalogCategoryNotFoundError);

    expect(repository.updateItem).not.toHaveBeenCalled();
  });

  it('CAT-T-020: trims fields, updates item, publishes event and audit log', async () => {
    repository.findItemById.mockResolvedValue(itemRecord());
    repository.findCategoryById.mockResolvedValue({
      id: 'category-2',
      active: true,
    });
    repository.updateItem.mockResolvedValue(
      itemRecord({
        id: 'item-1',
        categoryId: 'category-2',
        name: 'Produto premium',
        description: 'Descricao final',
        basePrice: '19.90',
        tags: ['premium'],
      }),
    );

    const result = await sut.execute({
      tenantId: 'tenant-1',
      itemId: 'item-1',
      categoryId: 'category-2',
      type: 'PRODUCT',
      name: '  Produto premium  ',
      description: '  Descricao final  ',
      basePrice: '19.90',
      tags: ['premium'],
      attributes: { cor: 'azul' },
    });

    expect(repository.updateItem).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        itemId: 'item-1',
        categoryId: 'category-2',
        name: 'Produto premium',
        description: 'Descricao final',
      }),
    );
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.any(CatalogItemUpdatedIntegrationEvent),
    );
    expect(repository.saveAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        event: 'ITEM_UPDATED',
        entityId: 'item-1',
        entityType: 'ITEM',
      }),
    );
    expect(result.name).toBe('Produto premium');
  });
});
