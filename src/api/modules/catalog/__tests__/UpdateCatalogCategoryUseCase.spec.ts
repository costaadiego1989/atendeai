import { UpdateCatalogCategoryUseCase } from '../application/use-cases/UpdateCatalogCategoryUseCase';
import {
  ICatalogRepository,
  CatalogCategoryRecord,
} from '../domain/ports/ICatalogRepository';
import { EntityNotFoundException } from '@shared/domain/exceptions/DomainExceptions';

describe('UpdateCatalogCategoryUseCase', () => {
  let repository: jest.Mocked<
    Pick<
      ICatalogRepository,
      'findCategoryById' | 'updateCategory' | 'saveAuditLog'
    >
  >;
  let sut: UpdateCatalogCategoryUseCase;

  const categoryRecord = (
    over?: Partial<CatalogCategoryRecord>,
  ): CatalogCategoryRecord => ({
    id: 'category-1',
    tenantId: 'tenant-1',
    parentCategoryId: null,
    parentCategoryName: null,
    path: ['category-1'],
    level: 0,
    name: 'Bebidas',
    description: null,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  });

  beforeEach(() => {
    repository = {
      findCategoryById: jest.fn(),
      updateCategory: jest.fn(),
      saveAuditLog: jest.fn().mockResolvedValue(undefined),
    };
    sut = new UpdateCatalogCategoryUseCase(
      repository as unknown as ICatalogRepository,
    );
  });

  it('updates category name successfully', async () => {
    repository.findCategoryById.mockResolvedValue(categoryRecord());
    const updated = categoryRecord({ name: 'Sucos' });
    repository.updateCategory.mockResolvedValue(updated);

    const result = await sut.execute({
      tenantId: 'tenant-1',
      categoryId: 'category-1',
      name: '  Sucos  ',
    });

    expect(result).toBe(updated);
    expect(repository.updateCategory).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        categoryId: 'category-1',
        name: 'Sucos',
      }),
    );
  });

  it('throws EntityNotFoundException when category not found', async () => {
    repository.findCategoryById.mockResolvedValue(null);

    await expect(
      sut.execute({
        tenantId: 'tenant-1',
        categoryId: 'missing-cat',
        name: 'Novo nome',
      }),
    ).rejects.toBeInstanceOf(EntityNotFoundException);

    expect(repository.updateCategory).not.toHaveBeenCalled();
  });

  it('enforces tenant isolation - uses tenantId for lookup', async () => {
    repository.findCategoryById.mockResolvedValue(null);

    await expect(
      sut.execute({
        tenantId: 'tenant-other',
        categoryId: 'category-1',
        name: 'Hack',
      }),
    ).rejects.toBeInstanceOf(EntityNotFoundException);

    expect(repository.findCategoryById).toHaveBeenCalledWith(
      'tenant-other',
      'category-1',
    );
  });

  it('saves audit log after update', async () => {
    const updated = categoryRecord({ name: 'Atualizada' });
    repository.findCategoryById.mockResolvedValue(categoryRecord());
    repository.updateCategory.mockResolvedValue(updated);

    await sut.execute({
      tenantId: 'tenant-1',
      categoryId: 'category-1',
      name: 'Atualizada',
    });

    expect(repository.saveAuditLog).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      event: 'CATEGORY_UPDATED',
      entityId: 'category-1',
      entityType: 'CATEGORY',
      metadata: {
        name: 'Atualizada',
        parentCategoryId: null,
      },
    });
  });
});
