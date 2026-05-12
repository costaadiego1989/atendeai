import { CreateCatalogCategoryUseCase } from '../application/use-cases/CreateCatalogCategoryUseCase';
import {
  ICatalogRepository,
  CatalogCategoryRecord,
} from '../domain/ports/ICatalogRepository';

describe('CreateCatalogCategoryUseCase', () => {
  let repository: jest.Mocked<Pick<ICatalogRepository, 'createCategory' | 'saveAuditLog'>>;
  let sut: CreateCatalogCategoryUseCase;

  const categoryRecord = (over?: Partial<CatalogCategoryRecord>): CatalogCategoryRecord => ({
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
      createCategory: jest.fn(),
      saveAuditLog: jest.fn().mockResolvedValue(undefined),
    };
    sut = new CreateCatalogCategoryUseCase(
      repository as unknown as ICatalogRepository,
    );
  });

  it('creates category successfully', async () => {
    const expected = categoryRecord();
    repository.createCategory.mockResolvedValue(expected);

    const result = await sut.execute({
      tenantId: 'tenant-1',
      name: 'Bebidas',
    });

    expect(result).toBe(expected);
    expect(repository.createCategory).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      name: 'Bebidas',
      description: undefined,
      parentCategoryId: undefined,
    });
  });

  it('trims name and description before persisting', async () => {
    repository.createCategory.mockResolvedValue(categoryRecord());

    await sut.execute({
      tenantId: 'tenant-1',
      name: '  Bebidas  ',
      description: '  Categoria de bebidas  ',
    });

    expect(repository.createCategory).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Bebidas',
        description: 'Categoria de bebidas',
      }),
    );
  });

  it('associates with tenant', async () => {
    repository.createCategory.mockResolvedValue(
      categoryRecord({ tenantId: 'tenant-42' }),
    );

    await sut.execute({
      tenantId: 'tenant-42',
      name: 'Alimentos',
    });

    expect(repository.createCategory).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-42' }),
    );
  });

  it('passes parentCategoryId when provided', async () => {
    repository.createCategory.mockResolvedValue(
      categoryRecord({ parentCategoryId: 'parent-1' }),
    );

    await sut.execute({
      tenantId: 'tenant-1',
      parentCategoryId: 'parent-1',
      name: 'Sucos',
    });

    expect(repository.createCategory).toHaveBeenCalledWith(
      expect.objectContaining({ parentCategoryId: 'parent-1' }),
    );
  });

  it('saves audit log after creation', async () => {
    repository.createCategory.mockResolvedValue(categoryRecord());

    await sut.execute({
      tenantId: 'tenant-1',
      name: 'Bebidas',
    });

    expect(repository.saveAuditLog).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      event: 'CATEGORY_CREATED',
      entityId: 'category-1',
      entityType: 'CATEGORY',
      metadata: {
        name: 'Bebidas',
        parentCategoryId: null,
      },
    });
  });
});
