import { CatalogFacade } from '../application/facades/CatalogFacade';
import {
  ICatalogRepository,
  CatalogCategoryRecord,
  CatalogItemRecord,
} from '../domain/ports/ICatalogRepository';

describe('CatalogFacade', () => {
  let repository: jest.Mocked<
    Pick<ICatalogRepository, 'listCategories' | 'listItems'>
  >;
  let facade: CatalogFacade;

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
      listCategories: jest.fn(),
      listItems: jest.fn(),
    };
    facade = new CatalogFacade(repository as unknown as ICatalogRepository);
  });

  it('delegates listCategories to repository', async () => {
    const categories = [categoryRecord()];
    repository.listCategories.mockResolvedValue(categories);

    const result = await facade.listCategories('tenant-1');

    expect(result).toBe(categories);
    expect(repository.listCategories).toHaveBeenCalledWith('tenant-1');
  });

  it('delegates searchItems to repository.listItems with correct params', async () => {
    const items = [itemRecord()];
    repository.listItems.mockResolvedValue(items);

    const input = {
      tenantId: 'tenant-1',
      type: 'PRODUCT',
      categoryId: 'cat-1',
      query: 'suco',
      includeInactive: true,
    };

    const result = await facade.searchItems(input);

    expect(result).toBe(items);
    expect(repository.listItems).toHaveBeenCalledWith(input);
  });

  it('returns results from repository without transformation', async () => {
    const items = [
      itemRecord({ id: 'item-1', name: 'A' }),
      itemRecord({ id: 'item-2', name: 'B' }),
    ];
    repository.listItems.mockResolvedValue(items);

    const result = await facade.searchItems({ tenantId: 'tenant-1' });

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('A');
    expect(result[1].name).toBe('B');
  });
});
