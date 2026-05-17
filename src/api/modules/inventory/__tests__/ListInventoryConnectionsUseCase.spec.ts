import { ListInventoryConnectionsUseCase } from '../application/use-cases/ListInventoryConnectionsUseCase';
import {
  IInventoryRepository,
  InventoryConnectionRecord,
} from '../domain/ports/IInventoryRepository';

describe('ListInventoryConnectionsUseCase', () => {
  let useCase: ListInventoryConnectionsUseCase;
  let inventoryRepository: jest.Mocked<IInventoryRepository>;

  const makeConnection = (
    overrides: Partial<InventoryConnectionRecord> = {},
  ): InventoryConnectionRecord => ({
    id: 'conn-1',
    tenantId: 'tenant-1',
    sourceType: 'BLING',
    providerName: 'Bling ERP',
    status: 'ACTIVE',
    config: { apiKey: '***' },
    configSummary: 'apiKey: ***',
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
    useCase = new ListInventoryConnectionsUseCase(inventoryRepository);
  });

  it('should list connections for a given tenant', async () => {
    const connections = [
      makeConnection(),
      makeConnection({ id: 'conn-2', sourceType: 'TINY' }),
    ];
    inventoryRepository.listConnections.mockResolvedValue(connections);

    const result = await useCase.execute('tenant-1');

    expect(result).toHaveLength(2);
    expect(inventoryRepository.listConnections).toHaveBeenCalledWith(
      'tenant-1',
    );
  });

  it('should return empty list when no connections exist', async () => {
    inventoryRepository.listConnections.mockResolvedValue([]);

    const result = await useCase.execute('tenant-1');

    expect(result).toEqual([]);
  });

  it('should ensure tenant isolation by passing tenantId to repository', async () => {
    inventoryRepository.listConnections.mockResolvedValue([]);

    await useCase.execute('tenant-A');
    await useCase.execute('tenant-B');

    expect(inventoryRepository.listConnections).toHaveBeenCalledTimes(2);
    expect(inventoryRepository.listConnections).toHaveBeenNthCalledWith(
      1,
      'tenant-A',
    );
    expect(inventoryRepository.listConnections).toHaveBeenNthCalledWith(
      2,
      'tenant-B',
    );
  });
});
