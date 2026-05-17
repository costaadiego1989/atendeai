import { GenerateInventoryReportUseCase } from '../application/use-cases/GenerateInventoryReportUseCase';
import {
  IInventoryRepository,
  InventoryItemRecord,
} from '../domain/ports/IInventoryRepository';

describe('GenerateInventoryReportUseCase', () => {
  let useCase: GenerateInventoryReportUseCase;
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
      findConnectionByProvider: jest.fn(),
      markConnectionSyncedAt: jest.fn(),
    };
    useCase = new GenerateInventoryReportUseCase(inventoryRepository);
  });

  it('should generate report with filters applied', async () => {
    const items = [
      makeItem({ availabilityStatus: 'AVAILABLE' }),
      makeItem({
        id: 'item-2',
        sku: 'SKU-002',
        availabilityStatus: 'UNAVAILABLE',
        availableQuantity: 0,
      }),
    ];
    inventoryRepository.listItems.mockResolvedValue(items);

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      statuses: ['AVAILABLE'],
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].availabilityStatus).toBe('AVAILABLE');
    expect(inventoryRepository.listItems).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      query: undefined,
      availableOnly: undefined,
    });
  });

  it('should calculate summary correctly', async () => {
    const items = [
      makeItem({
        availabilityStatus: 'AVAILABLE',
        availableQuantity: 10,
        currentPrice: '20.00',
      }),
      makeItem({
        id: 'item-2',
        sku: 'SKU-002',
        availabilityStatus: 'LOW_STOCK',
        availableQuantity: 2,
        currentPrice: '15.00',
      }),
      makeItem({
        id: 'item-3',
        sku: 'SKU-003',
        availabilityStatus: 'UNAVAILABLE',
        availableQuantity: 0,
        currentPrice: '50.00',
      }),
    ];
    inventoryRepository.listItems.mockResolvedValue(items);

    const result = await useCase.execute({ tenantId: 'tenant-1' });

    expect(result.summary.totalItems).toBe(3);
    expect(result.summary.totalQuantity).toBe(12);
    expect(result.summary.availableItems).toBe(1);
    expect(result.summary.lowStockItems).toBe(1);
    expect(result.summary.unavailableItems).toBe(1);
    expect(result.summary.estimatedInventoryValue).toBe(
      10 * 20 + 2 * 15 + 0 * 50,
    );
  });

  it('should handle empty inventory', async () => {
    inventoryRepository.listItems.mockResolvedValue([]);

    const result = await useCase.execute({ tenantId: 'tenant-1' });

    expect(result.items).toEqual([]);
    expect(result.summary.totalItems).toBe(0);
    expect(result.summary.totalQuantity).toBe(0);
    expect(result.summary.estimatedInventoryValue).toBe(0);
  });

  it('should include generatedAt timestamp', async () => {
    inventoryRepository.listItems.mockResolvedValue([]);

    const before = new Date();
    const result = await useCase.execute({ tenantId: 'tenant-1' });
    const after = new Date();

    expect(result.generatedAt.getTime()).toBeGreaterThanOrEqual(
      before.getTime(),
    );
    expect(result.generatedAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it('should ensure tenant isolation by passing tenantId to repository', async () => {
    inventoryRepository.listItems.mockResolvedValue([]);

    await useCase.execute({ tenantId: 'tenant-A' });
    await useCase.execute({ tenantId: 'tenant-B' });

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
