import { InventoryFacade } from '../application/facades/InventoryFacade';
import {
  IInventoryRepository,
  InventoryItemRecord,
} from '../domain/ports/IInventoryRepository';

describe('InventoryFacade', () => {
  let facade: InventoryFacade;
  let inventoryRepository: jest.Mocked<IInventoryRepository>;

  const makeItem = (
    overrides: Partial<InventoryItemRecord> = {},
  ): InventoryItemRecord => ({
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
      getConnection: jest.fn(),
      findConnectionByProvider: jest.fn(),
      markConnectionSyncedAt: jest.fn(),
    };
    facade = new InventoryFacade(inventoryRepository);
  });

  it('should delegate listItems to repository', async () => {
    const items = [makeItem(), makeItem({ id: 'item-2', sku: 'SKU-002' })];
    inventoryRepository.listItems.mockResolvedValue(items);

    const result = await facade.listItems({ tenantId: 'tenant-1' });

    expect(result).toEqual(items);
    expect(inventoryRepository.listItems).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
    });
  });

  it('should pass filters through to repository', async () => {
    inventoryRepository.listItems.mockResolvedValue([makeItem()]);

    await facade.listItems({
      tenantId: 'tenant-1',
      query: 'SKU',
      availableOnly: true,
    });

    expect(inventoryRepository.listItems).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      query: 'SKU',
      availableOnly: true,
    });
  });

  it('should return empty array when no items found', async () => {
    inventoryRepository.listItems.mockResolvedValue([]);

    const result = await facade.listItems({ tenantId: 'tenant-1' });

    expect(result).toEqual([]);
  });

  it('should ensure tenant isolation in queries', async () => {
    inventoryRepository.listItems.mockResolvedValue([]);

    await facade.listItems({ tenantId: 'tenant-A' });
    await facade.listItems({ tenantId: 'tenant-B' });

    expect(inventoryRepository.listItems).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ tenantId: 'tenant-A' }),
    );
    expect(inventoryRepository.listItems).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ tenantId: 'tenant-B' }),
    );
  });
});
