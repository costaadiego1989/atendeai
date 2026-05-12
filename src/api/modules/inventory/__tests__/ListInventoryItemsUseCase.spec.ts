import { ListInventoryItemsUseCase } from '../application/use-cases/ListInventoryItemsUseCase';
import { IInventoryRepository, InventoryItemRecord } from '../domain/ports/IInventoryRepository';

describe('ListInventoryItemsUseCase', () => {
  let useCase: ListInventoryItemsUseCase;
  let inventoryRepository: jest.Mocked<IInventoryRepository>;

  const makeItem = (overrides: Partial<InventoryItemRecord> = {}): InventoryItemRecord => ({
    id: 'item-1',
    tenantId: 'tenant-1',
    catalogItemId: null,
    sku: 'SKU-001',
    externalReference: null,
    name: 'Produto Teste',
    availableQuantity: 10,
    availabilityStatus: 'AVAILABLE',
    currentPrice: '29.90',
    currency: 'BRL',
    source: 'BLING',
    lastSyncedAt: new Date('2024-01-01'),
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  });

  beforeEach(() => {
    inventoryRepository = {
      syncItem: jest.fn(),
      listItems: jest.fn(),
      findItemBySku: jest.fn(),
      createConnection: jest.fn(),
      listConnections: jest.fn(),
      findConnectionByProvider: jest.fn(),
      markConnectionSyncedAt: jest.fn(),
    };
    useCase = new ListInventoryItemsUseCase(inventoryRepository);
  });

  it('should list items for a given tenant', async () => {
    const items = [makeItem(), makeItem({ id: 'item-2', sku: 'SKU-002' })];
    inventoryRepository.listItems.mockResolvedValue(items);

    const result = await useCase.execute({ tenantId: 'tenant-1' });

    expect(result).toHaveLength(2);
    expect(inventoryRepository.listItems).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
    });
  });

  it('should pass query filter to repository', async () => {
    inventoryRepository.listItems.mockResolvedValue([makeItem()]);

    await useCase.execute({ tenantId: 'tenant-1', query: 'SKU-001' });

    expect(inventoryRepository.listItems).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      query: 'SKU-001',
    });
  });

  it('should pass availableOnly filter to repository', async () => {
    inventoryRepository.listItems.mockResolvedValue([makeItem()]);

    await useCase.execute({ tenantId: 'tenant-1', availableOnly: true });

    expect(inventoryRepository.listItems).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      availableOnly: true,
    });
  });

  it('should return empty list when no items exist', async () => {
    inventoryRepository.listItems.mockResolvedValue([]);

    const result = await useCase.execute({ tenantId: 'tenant-1' });

    expect(result).toEqual([]);
  });

  it('should ensure tenant isolation by passing tenantId to repository', async () => {
    inventoryRepository.listItems.mockResolvedValue([]);

    await useCase.execute({ tenantId: 'tenant-A' });
    await useCase.execute({ tenantId: 'tenant-B' });

    expect(inventoryRepository.listItems).toHaveBeenCalledTimes(2);
    expect(inventoryRepository.listItems).toHaveBeenNthCalledWith(1, {
      tenantId: 'tenant-A',
    });
    expect(inventoryRepository.listItems).toHaveBeenNthCalledWith(2, {
      tenantId: 'tenant-B',
    });
  });
});
