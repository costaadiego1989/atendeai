import { DeactivateCatalogCategoryUseCase } from '../application/use-cases/DeactivateCatalogCategoryUseCase';
import { CatalogCategoryNotFoundError } from '../domain/errors/CatalogCategoryNotFoundError';
import { CatalogCategoryInUseError } from '../domain/errors/CatalogCategoryInUseError';
import { CatalogCategoryDeactivatedIntegrationEvent } from '../application/integration-events/CatalogIntegrationEvents';

describe('DeactivateCatalogCategoryUseCase', () => {
  let repository: any;
  let eventBus: any;
  let sut: DeactivateCatalogCategoryUseCase;

  beforeEach(() => {
    repository = {
      findCategoryById: jest.fn(),
      hasActiveItemsInCategory: jest.fn(),
      deactivateCategory: jest.fn(),
      saveAuditLog: jest.fn(),
    };
    eventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
    };
    sut = new DeactivateCatalogCategoryUseCase(repository, eventBus);
  });

  it('CAT-T-033: missing category fails before repository mutation', async () => {
    repository.findCategoryById.mockResolvedValue(null);

    await expect(
      sut.execute({ tenantId: 'tenant-1', categoryId: 'category-missing' }),
    ).rejects.toBeInstanceOf(CatalogCategoryNotFoundError);

    expect(repository.hasActiveItemsInCategory).not.toHaveBeenCalled();
    expect(repository.deactivateCategory).not.toHaveBeenCalled();
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it('CAT-T-034: category with active items cannot be deactivated', async () => {
    repository.findCategoryById.mockResolvedValue({
      id: 'category-1',
      tenantId: 'tenant-1',
      active: true,
    });
    repository.hasActiveItemsInCategory.mockResolvedValue(true);

    await expect(
      sut.execute({ tenantId: 'tenant-1', categoryId: 'category-1' }),
    ).rejects.toBeInstanceOf(CatalogCategoryInUseError);

    expect(repository.deactivateCategory).not.toHaveBeenCalled();
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it('CAT-T-021: deactivates empty category and emits integration event', async () => {
    const deactivated = {
      id: 'category-1',
      tenantId: 'tenant-1',
      name: 'Sem itens',
      active: false,
    };
    repository.findCategoryById.mockResolvedValue({
      ...deactivated,
      active: true,
    });
    repository.hasActiveItemsInCategory.mockResolvedValue(false);
    repository.deactivateCategory.mockResolvedValue(deactivated);

    const result = await sut.execute({
      tenantId: 'tenant-1',
      categoryId: 'category-1',
    });

    expect(repository.deactivateCategory).toHaveBeenCalledWith(
      'tenant-1',
      'category-1',
    );
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.any(CatalogCategoryDeactivatedIntegrationEvent),
    );
    expect(repository.saveAuditLog).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      event: 'CATEGORY_DEACTIVATED',
      entityId: 'category-1',
      entityType: 'CATEGORY',
    });
    expect(result).toBe(deactivated);
  });
});
