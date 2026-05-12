import { GenerateCatalogReportUseCase } from '../application/use-cases/GenerateCatalogReportUseCase';
import {
  ICatalogRepository,
  CatalogItemRecord,
} from '../domain/ports/ICatalogRepository';

describe('GenerateCatalogReportUseCase', () => {
  let repository: jest.Mocked<Pick<ICatalogRepository, 'listItems'>>;
  let sut: GenerateCatalogReportUseCase;

  const itemRecord = (over?: Partial<CatalogItemRecord>): CatalogItemRecord => ({
    id: 'item-1',
    tenantId: 'tenant-1',
    categoryId: 'cat-1',
    categoryName: 'Bebidas',
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
    sut = new GenerateCatalogReportUseCase(
      repository as unknown as ICatalogRepository,
    );
  });

  it('generates report with correct summary', async () => {
    const items = [
      itemRecord({ id: 'item-1', type: 'PRODUCT', active: true, basePrice: '10.00' }),
      itemRecord({ id: 'item-2', type: 'SERVICE', active: true, basePrice: '50.00' }),
      itemRecord({ id: 'item-3', type: 'PRODUCT', active: false, basePrice: '20.00' }),
    ];
    repository.listItems.mockResolvedValue(items);

    const result = await sut.execute({ tenantId: 'tenant-1' });

    expect(result.summary.totalItems).toBe(3);
    expect(result.summary.activeItems).toBe(2);
    expect(result.summary.inactiveItems).toBe(1);
    expect(result.summary.services).toBe(1);
    expect(result.summary.products).toBe(2);
    expect(result.summary.estimatedBaseValue).toBe(80);
    expect(result.items).toHaveLength(3);
    expect(result.generatedAt).toBeInstanceOf(Date);
  });

  it('filters by type when types are provided', async () => {
    const items = [
      itemRecord({ id: 'item-1', type: 'PRODUCT' }),
      itemRecord({ id: 'item-2', type: 'SERVICE' }),
      itemRecord({ id: 'item-3', type: 'RENTAL' }),
    ];
    repository.listItems.mockResolvedValue(items);

    const result = await sut.execute({
      tenantId: 'tenant-1',
      types: ['SERVICE'],
    });

    expect(result.summary.totalItems).toBe(1);
    expect(result.items[0].type).toBe('SERVICE');
  });

  it('handles empty catalog', async () => {
    repository.listItems.mockResolvedValue([]);

    const result = await sut.execute({ tenantId: 'tenant-1' });

    expect(result.summary.totalItems).toBe(0);
    expect(result.summary.activeItems).toBe(0);
    expect(result.summary.inactiveItems).toBe(0);
    expect(result.summary.estimatedBaseValue).toBe(0);
    expect(result.items).toEqual([]);
  });

  it('scopes query to tenant (tenant isolation)', async () => {
    repository.listItems.mockResolvedValue([]);

    await sut.execute({ tenantId: 'tenant-42' });

    expect(repository.listItems).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-42' }),
    );
  });

  it('filters by categoryIds when provided', async () => {
    const items = [
      itemRecord({ id: 'item-1', categoryId: 'cat-1' }),
      itemRecord({ id: 'item-2', categoryId: 'cat-2' }),
      itemRecord({ id: 'item-3', categoryId: null }),
    ];
    repository.listItems.mockResolvedValue(items);

    const result = await sut.execute({
      tenantId: 'tenant-1',
      categoryIds: ['cat-1'],
    });

    expect(result.summary.totalItems).toBe(1);
    expect(result.items[0].categoryId).toBe('cat-1');
  });
});
