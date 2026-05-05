import { SyncInventoryConnectionUseCase } from '../application/use-cases/SyncInventoryConnectionUseCase';
import { SyncInventoryItemUseCase } from '../application/use-cases/SyncInventoryItemUseCase';
import {
  IInventoryProviderFactory,
  InventoryItemSnapshot,
} from '../application/ports/IInventoryProvider';
import {
  IInventoryRepository,
  InventoryConnectionRecord,
  InventoryItemRecord,
} from '../domain/ports/IInventoryRepository';
import { InventoryConnectionNotFoundError } from '../domain/errors/InventoryConnectionNotFoundError';

describe('SyncInventoryConnectionUseCase', () => {
  let useCase: SyncInventoryConnectionUseCase;
  let inventoryRepository: jest.Mocked<IInventoryRepository>;
  let providerFactory: jest.Mocked<IInventoryProviderFactory>;
  let syncInventoryItemUseCase: jest.Mocked<Pick<SyncInventoryItemUseCase, 'execute'>>;

  const baseConnection = (): InventoryConnectionRecord => ({
    id: 'conn-1',
    tenantId: 'tenant-1',
    sourceType: 'BLING',
    providerName: 'Bling Principal',
    status: 'ACTIVE',
    config: { accessToken: 'tok' },
    lastSyncedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const stubItem = (sku: string): InventoryItemRecord => ({
    id: `item-${sku}`,
    tenantId: 'tenant-1',
    catalogItemId: null,
    sku,
    externalReference: null,
    name: 'Produto',
    availableQuantity: 1,
    availabilityStatus: 'AVAILABLE',
    currentPrice: '1.00',
    currency: 'BRL',
    source: 'BLING',
    lastSyncedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
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

    syncInventoryItemUseCase = {
      execute: jest.fn().mockResolvedValue(stubItem('default')),
    };

    providerFactory = {
      getProvider: jest.fn(),
    };

    useCase = new SyncInventoryConnectionUseCase(
      inventoryRepository,
      providerFactory,
      syncInventoryItemUseCase as unknown as SyncInventoryItemUseCase,
    );
  });

  it('INV-SYNC-001: lança InventoryConnectionNotFoundError quando a conexão não existe no tenant', async () => {
    inventoryRepository.listConnections.mockResolvedValue([]);

    await expect(
      useCase.execute({
        tenantId: 'tenant-1',
        connectionId: 'missing',
      }),
    ).rejects.toBeInstanceOf(InventoryConnectionNotFoundError);

    expect(providerFactory.getProvider).not.toHaveBeenCalled();
    expect(inventoryRepository.markConnectionSyncedAt).not.toHaveBeenCalled();
  });

  it('INV-SYNC-002: sincroniza lotes, tolera falha por SKU e marca lastSyncedAt na conexão ao concluir', async () => {
    const conn = baseConnection();
    inventoryRepository.listConnections.mockResolvedValue([conn]);

    const snap: InventoryItemSnapshot = {
      sku: 'SKU-1',
      externalReference: 'ext-1',
      name: 'Produto',
      availableQuantity: 2,
      availabilityStatus: 'AVAILABLE',
      currentPrice: '10.00',
      currency: 'BRL',
    };

    providerFactory.getProvider.mockReturnValue({
      testConnection: jest.fn(),
      async *fetchStock() {
        yield [snap];
        yield [{ ...snap, sku: 'SKU-2', externalReference: 'ext-2' }];
      },
    });

    syncInventoryItemUseCase.execute
      .mockResolvedValueOnce(stubItem('SKU-1'))
      .mockRejectedValueOnce(new Error('SKU bloqueado'));

    await useCase.execute({
      tenantId: conn.tenantId,
      connectionId: conn.id,
    });

    expect(syncInventoryItemUseCase.execute).toHaveBeenCalledTimes(2);
    expect(inventoryRepository.markConnectionSyncedAt).toHaveBeenCalledTimes(1);
    expect(inventoryRepository.markConnectionSyncedAt).toHaveBeenCalledWith(
      conn.id,
      expect.any(Date),
    );
  });

  it('INV-SYNC-003: erro global em fetchStock não marca conexão e propaga', async () => {
    const conn = baseConnection();
    inventoryRepository.listConnections.mockResolvedValue([conn]);

    providerFactory.getProvider.mockReturnValue({
      testConnection: jest.fn(),
      async *fetchStock() {
        throw new Error('API indisponível');
        yield [];
      },
    });

    await expect(
      useCase.execute({
        tenantId: conn.tenantId,
        connectionId: conn.id,
      }),
    ).rejects.toThrow('API indisponível');

    expect(inventoryRepository.markConnectionSyncedAt).not.toHaveBeenCalled();
  });

  it('INV-SYNC-004: repassa lastSyncedAt da conexão ao provider quando definido', async () => {
    const syncedAt = new Date('2024-01-15T12:00:00Z');
    const conn = { ...baseConnection(), lastSyncedAt: syncedAt };
    inventoryRepository.listConnections.mockResolvedValue([conn]);

    const fetchStock = jest
      .fn()
      .mockImplementation(async function* emptyStock() {
        yield [];
      });

    providerFactory.getProvider.mockReturnValue({
      testConnection: jest.fn(),
      fetchStock,
    });

    await useCase.execute({
      tenantId: conn.tenantId,
      connectionId: conn.id,
    });

    expect(fetchStock).toHaveBeenCalledWith(conn.config, syncedAt);
  });
});
