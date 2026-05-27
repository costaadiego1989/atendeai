import { CreateCatalogItemUseCase } from '../application/use-cases/CreateCatalogItemUseCase';
import {
  ICatalogRepository,
  CatalogItemRecord,
} from '../domain/ports/ICatalogRepository';
import { CatalogCategoryNotFoundError } from '../domain/errors/CatalogCategoryNotFoundError';
import { CatalogItemCreatedIntegrationEvent } from '../application/integration-events/CatalogIntegrationEvents';
import { IInventorySyncPort } from '../application/ports/IInventorySyncPort';
import { IEventBus } from '@shared/application/ports/IEventBus';

describe('CreateCatalogItemUseCase', () => {
  let catalogRepository: jest.Mocked<
    Pick<ICatalogRepository, 'findCategoryById' | 'createItem' | 'saveAuditLog'>
  >;
  let eventBus: jest.Mocked<IEventBus>;
  let inventorySyncPort: jest.Mocked<IInventorySyncPort>;
  let useCase: CreateCatalogItemUseCase;

  const itemRecord = (
    over?: Partial<CatalogItemRecord>,
  ): CatalogItemRecord => ({
    id: 'catalog-item-1',
    tenantId: 'tenant-1',
    categoryId: null,
    categoryName: null,
    type: 'PHYSICAL',
    name: 'Camisa',
    description: null,
    basePrice: '19.90',
    currency: 'BRL',
    tags: [],
    active: true,
    source: 'MANUAL',
    externalReference: 'ref-abc',
    imageUrl: null,
    attributes: {},
    variants: [],
    optionGroups: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  });

  beforeEach(() => {
    catalogRepository = {
      findCategoryById: jest.fn(),
      createItem: jest.fn(),
      saveAuditLog: jest.fn(),
    };
    eventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
      subscribe: jest.fn(),
    };
    inventorySyncPort = {
      syncItem: jest.fn().mockResolvedValue(undefined),
    };

    useCase = new CreateCatalogItemUseCase(
      catalogRepository as unknown as ICatalogRepository,
      eventBus,
      inventorySyncPort,
    );
  });

  it('CAT-T-030: categoryId inválido lança CatalogCategoryNotFoundError', async () => {
    catalogRepository.findCategoryById.mockResolvedValue(null);

    await expect(
      useCase.execute({
        tenantId: 'tenant-1',
        categoryId: 'cat-inexistente',
        type: 'PHYSICAL',
        name: 'Item',
      }),
    ).rejects.toBeInstanceOf(CatalogCategoryNotFoundError);

    expect(catalogRepository.createItem).not.toHaveBeenCalled();
    expect(inventorySyncPort.syncItem).not.toHaveBeenCalled();
  });

  it('CAT-T-040: item físico com stock inicial invoca inventorySyncPort', async () => {
    catalogRepository.createItem.mockResolvedValue(itemRecord());

    await useCase.execute({
      tenantId: 'tenant-1',
      type: 'PHYSICAL',
      name: 'Camisa',
      externalReference: 'ref-abc',
      initialStock: 4,
    });

    expect(eventBus.publish).toHaveBeenCalled();
    expect(eventBus.publish.mock.calls[0][0]).toBeInstanceOf(
      CatalogItemCreatedIntegrationEvent,
    );
    expect(inventorySyncPort.syncItem).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        catalogItemId: 'catalog-item-1',
        sku: 'REF-ABC',
        availableQuantity: 4,
        availabilityStatus: 'AVAILABLE',
        source: 'MANUAL_SNAPSHOT',
      }),
    );
    expect(catalogRepository.saveAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'ITEM_CREATED' }),
    );
  });

  it('CAT-T-041: tipo SERVICE não sincroniza inventário', async () => {
    catalogRepository.createItem.mockResolvedValue(
      itemRecord({ type: 'SERVICE', externalReference: null }),
    );

    await useCase.execute({
      tenantId: 'tenant-1',
      type: 'SERVICE',
      name: 'Instalação',
    });

    expect(inventorySyncPort.syncItem).not.toHaveBeenCalled();
  });
});
