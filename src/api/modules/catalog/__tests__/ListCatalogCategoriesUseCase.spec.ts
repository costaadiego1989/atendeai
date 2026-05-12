import { ListCatalogCategoriesUseCase } from '../application/use-cases/ListCatalogCategoriesUseCase';
import {
  ICatalogRepository,
  CatalogCategoryRecord,
} from '../domain/ports/ICatalogRepository';

describe('ListCatalogCategoriesUseCase', () => {
  let repository: jest.Mocked<Pick<ICatalogRepository, 'listCategories'>>;
  let sut: ListCatalogCategoriesUseCase;

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
      listCategories: jest.fn(),
    };
    sut = new ListCatalogCategoriesUseCase(
      repository as unknown as ICatalogRepository,
    );
  });

  it('lists all categories for tenant', async () => {
    const categories = [
      categoryRecord({ id: 'cat-1', name: 'Bebidas' }),
      categoryRecord({ id: 'cat-2', name: 'Alimentos' }),
    ];
    repository.listCategories.mockResolvedValue(categories);

    const result = await sut.execute('tenant-1');

    expect(result).toBe(categories);
    expect(repository.listCategories).toHaveBeenCalledWith('tenant-1');
  });

  it('returns empty list when no categories exist', async () => {
    repository.listCategories.mockResolvedValue([]);

    const result = await sut.execute('tenant-1');

    expect(result).toEqual([]);
  });

  it('scopes query to the provided tenantId', async () => {
    repository.listCategories.mockResolvedValue([]);

    await sut.execute('tenant-42');

    expect(repository.listCategories).toHaveBeenCalledWith('tenant-42');
  });
});
