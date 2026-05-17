import { ListCatalogItemsUseCase } from '../application/use-cases/ListCatalogItemsUseCase';
import {
  ICatalogRepository,
  CatalogItemRecord,
} from '../domain/ports/ICatalogRepository';

describe('ListCatalogItemsUseCase', () => {
  let repository: jest.Mocked<Pick<ICatalogRepository, 'listItems'>>;
  let sut: ListCatalogItemsUseCase;

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
      listItems: jest.fn(),
    };
    sut = new ListCatalogItemsUseCase(
      repository as unknown as ICatalogRepository,
    );
  });

  it('lists all items for tenant', async () => {
    const items = [
      itemRecord({ id: 'item-1', name: 'Produto A' }),
      itemRecord({ id: 'item-2', name: 'Produto B' }),
    ];
    repository.listItems.mockResolvedValue(items);

    const result = await sut.execute({ tenantId: 'tenant-1' });

    expect(result).toBe(items);
    expect(repository.listItems).toHaveBeenCalledWith({ tenantId: 'tenant-1' });
  });

  it('filters by category', async () => {
    repository.listItems.mockResolvedValue([]);

    await sut.execute({ tenantId: 'tenant-1', categoryId: 'cat-1' });

    expect(repository.listItems).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      categoryId: 'cat-1',
    });
  });

  it('passes query filter', async () => {
    repository.listItems.mockResolvedValue([]);

    await sut.execute({ tenantId: 'tenant-1', query: 'camisa' });

    expect(repository.listItems).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      query: 'camisa',
    });
  });

  it('returns empty list when no items match', async () => {
    repository.listItems.mockResolvedValue([]);

    const result = await sut.execute({ tenantId: 'tenant-1' });

    expect(result).toEqual([]);
  });
});
