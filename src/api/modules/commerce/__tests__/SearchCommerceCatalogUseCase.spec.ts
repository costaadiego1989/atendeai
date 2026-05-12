import { SearchCommerceCatalogUseCase } from '../application/use-cases/SearchCommerceCatalogUseCase';
import { ICatalogQueryPort } from '@modules/catalog/application/facades/CatalogFacade';
import { IInventoryQueryPort } from '@modules/inventory/application/facades/InventoryFacade';

describe('SearchCommerceCatalogUseCase', () => {
  let useCase: SearchCommerceCatalogUseCase;
  let inventoryQueryPort: jest.Mocked<IInventoryQueryPort>;
  let catalogQueryPort: jest.Mocked<ICatalogQueryPort>;

  const tenantId = 'tenant-1';

  beforeEach(() => {
    inventoryQueryPort = {
      listItems: jest.fn(),
    } as any;

    catalogQueryPort = {
      searchItems: jest.fn(),
    } as any;

    useCase = new SearchCommerceCatalogUseCase(inventoryQueryPort, catalogQueryPort);
  });

  it('should search by keyword and return combined results', async () => {
    inventoryQueryPort.listItems.mockResolvedValue([
      {
        id: 'inv-1',
        tenantId,
        catalogItemId: null,
        name: 'Pizza Margherita',
        currentPrice: 35,
        currency: 'BRL',
        availableQuantity: 10,
        availabilityStatus: 'AVAILABLE',
      } as any,
    ]);

    catalogQueryPort.searchItems.mockResolvedValue([
      {
        id: 'cat-1',
        tenantId,
        name: 'Pizza Calabresa',
        basePrice: 40,
        currency: 'BRL',
        categoryName: 'Pizzas',
        attributes: {},
        variants: [],
        optionGroups: [],
      } as any,
    ]);

    const result = await useCase.execute({ tenantId, query: 'pizza' });

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      optionNumber: 1,
      source: 'INVENTORY',
      name: 'Pizza Margherita',
    });
    expect(result[1]).toMatchObject({
      optionNumber: 2,
      source: 'CATALOG',
      name: 'Pizza Calabresa',
    });
  });

  it('should return empty results when nothing matches', async () => {
    inventoryQueryPort.listItems.mockResolvedValue([]);
    catalogQueryPort.searchItems.mockResolvedValue([]);

    const result = await useCase.execute({ tenantId, query: 'nonexistent' });

    expect(result).toHaveLength(0);
  });

  it('should deduplicate catalog items already present in inventory', async () => {
    inventoryQueryPort.listItems.mockResolvedValue([
      {
        id: 'inv-1',
        tenantId,
        catalogItemId: 'cat-1',
        name: 'Pizza Margherita',
        currentPrice: 35,
        currency: 'BRL',
        availableQuantity: 10,
        availabilityStatus: 'AVAILABLE',
      } as any,
    ]);

    catalogQueryPort.searchItems.mockResolvedValue([
      {
        id: 'cat-1',
        tenantId,
        name: 'Pizza Margherita',
        basePrice: 35,
        currency: 'BRL',
        categoryName: 'Pizzas',
        attributes: {},
        variants: [],
        optionGroups: [],
      } as any,
    ]);

    const result = await useCase.execute({ tenantId, query: 'pizza' });

    // cat-1 is already in inventory, so it should not appear as a separate catalog option
    expect(result).toHaveLength(1);
    expect(result[0].source).toBe('INVENTORY');
  });

  it('should ensure tenant isolation by passing tenantId to both ports', async () => {
    inventoryQueryPort.listItems.mockResolvedValue([]);
    catalogQueryPort.searchItems.mockResolvedValue([]);

    await useCase.execute({ tenantId: 'tenant-2', query: 'item' });

    expect(inventoryQueryPort.listItems).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-2' }),
    );
    expect(catalogQueryPort.searchItems).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-2' }),
    );
  });

  it('should limit results to the specified limit', async () => {
    const manyItems = Array.from({ length: 15 }, (_, i) => ({
      id: `inv-${i}`,
      tenantId,
      catalogItemId: null,
      name: `Item ${i}`,
      currentPrice: 10,
      currency: 'BRL',
      availableQuantity: 5,
      availabilityStatus: 'AVAILABLE',
    }));

    inventoryQueryPort.listItems.mockResolvedValue(manyItems as any);
    catalogQueryPort.searchItems.mockResolvedValue([]);

    const result = await useCase.execute({ tenantId, query: 'item', limit: 5 });

    expect(result).toHaveLength(5);
  });
});
