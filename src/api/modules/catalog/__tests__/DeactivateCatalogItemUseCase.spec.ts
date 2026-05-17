import { DeactivateCatalogItemUseCase } from '../application/use-cases/DeactivateCatalogItemUseCase';
import { CatalogItemNotFoundError } from '../domain/errors/CatalogItemNotFoundError';
import { CatalogItemDeactivatedIntegrationEvent } from '../application/integration-events/CatalogIntegrationEvents';
import {
  CatalogItemRecord,
  ICatalogRepository,
} from '../domain/ports/ICatalogRepository';
import { IEventBus } from '@shared/application/ports/IEventBus';

describe('DeactivateCatalogItemUseCase', () => {
  let repository: jest.Mocked<
    Pick<ICatalogRepository, 'findItemById' | 'deactivateItem' | 'saveAuditLog'>
  >;
  let eventBus: jest.Mocked<IEventBus>;
  let sut: DeactivateCatalogItemUseCase;

  const itemRecord = (
    over?: Partial<CatalogItemRecord>,
  ): CatalogItemRecord => ({
    id: 'item-1',
    tenantId: 'tenant-1',
    categoryId: null,
    categoryName: null,
    type: 'PRODUCT',
    name: 'Produto',
    description: null,
    basePrice: '10.00',
    currency: 'BRL',
    tags: [],
    active: true,
    source: 'MANUAL',
    externalReference: null,
    imageUrl: null,
    attributes: {},
    variants: [],
    optionGroups: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  });

  beforeEach(() => {
    repository = {
      findItemById: jest.fn(),
      deactivateItem: jest.fn(),
      saveAuditLog: jest.fn().mockResolvedValue(undefined),
    };
    eventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
      subscribe: jest.fn(),
    };
    sut = new DeactivateCatalogItemUseCase(
      repository as unknown as ICatalogRepository,
      eventBus,
    );
  });

  it('deactivates item successfully and publishes event', async () => {
    const existing = itemRecord();
    const deactivated = itemRecord({ active: false });
    repository.findItemById.mockResolvedValue(existing);
    repository.deactivateItem.mockResolvedValue(deactivated);

    const result = await sut.execute({
      tenantId: 'tenant-1',
      itemId: 'item-1',
    });

    expect(result).toBe(deactivated);
    expect(repository.deactivateItem).toHaveBeenCalledWith(
      'tenant-1',
      'item-1',
    );
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.any(CatalogItemDeactivatedIntegrationEvent),
    );
    expect(repository.saveAuditLog).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      event: 'ITEM_DEACTIVATED',
      entityId: 'item-1',
      entityType: 'ITEM',
    });
  });

  it('throws CatalogItemNotFoundError when item does not exist', async () => {
    repository.findItemById.mockResolvedValue(null);

    await expect(
      sut.execute({ tenantId: 'tenant-1', itemId: 'missing-item' }),
    ).rejects.toBeInstanceOf(CatalogItemNotFoundError);

    expect(repository.deactivateItem).not.toHaveBeenCalled();
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it('enforces tenant isolation - uses tenantId for lookup', async () => {
    repository.findItemById.mockResolvedValue(null);

    await expect(
      sut.execute({ tenantId: 'tenant-other', itemId: 'item-1' }),
    ).rejects.toBeInstanceOf(CatalogItemNotFoundError);

    expect(repository.findItemById).toHaveBeenCalledWith(
      'tenant-other',
      'item-1',
    );
  });
});
