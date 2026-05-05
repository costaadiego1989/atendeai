import { SyncInventoryItemUseCase } from '../application/use-cases/SyncInventoryItemUseCase';
import { IInventoryRepository } from '../domain/ports/IInventoryRepository';
import { IEventBus } from '@shared/application/ports/IEventBus';
import { InventoryInvalidSkuError } from '../domain/errors/InventoryInvalidSkuError';
import { InventoryItemSyncedIntegrationEvent } from '../application/integration-events/InventoryIntegrationEvents';

describe('SyncInventoryItemUseCase', () => {
  let useCase: SyncInventoryItemUseCase;
  let inventoryRepository: jest.Mocked<IInventoryRepository>;
  let eventBus: jest.Mocked<IEventBus>;

  const savedItem = () => ({
    id: 'item-1',
    tenantId: 'tenant-1',
    catalogItemId: null,
    sku: 'SKU-1',
    externalReference: null,
    name: 'Produto',
    availableQuantity: 3,
    availabilityStatus: 'AVAILABLE',
    currentPrice: '9.99',
    currency: 'BRL',
    source: 'MANUAL_SNAPSHOT',
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
    eventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
      subscribe: jest.fn(),
    };
    useCase = new SyncInventoryItemUseCase(inventoryRepository, eventBus);
  });

  it('INV-T-090: rejeita SKU vazio ou só espaços com InventoryInvalidSkuError', async () => {
    await expect(
      useCase.execute({
        tenantId: 'tenant-1',
        sku: '',
        name: 'X',
        availableQuantity: 0,
        availabilityStatus: 'UNAVAILABLE',
      }),
    ).rejects.toBeInstanceOf(InventoryInvalidSkuError);

    await expect(
      useCase.execute({
        tenantId: 'tenant-1',
        sku: '   ',
        name: 'X',
        availableQuantity: 0,
        availabilityStatus: 'UNAVAILABLE',
      }),
    ).rejects.toBeInstanceOf(InventoryInvalidSkuError);

    expect(inventoryRepository.syncItem).not.toHaveBeenCalled();
  });

  it('INV-T-091: upsert feliz publica InventoryItemSyncedIntegrationEvent', async () => {
    inventoryRepository.findItemBySku.mockResolvedValue(null);
    const item = savedItem();
    inventoryRepository.syncItem.mockResolvedValue(item);

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      sku: '  SKU-1  ',
      name: '  Nome  ',
      availableQuantity: 3,
      availabilityStatus: 'AVAILABLE',
      source: 'MANUAL_SNAPSHOT',
    });

    expect(result.sku).toBe('SKU-1');
    expect(inventoryRepository.syncItem).toHaveBeenCalledWith(
      expect.objectContaining({
        sku: 'SKU-1',
        name: 'Nome',
        tenantId: 'tenant-1',
      }),
    );

    expect(eventBus.publish).toHaveBeenCalled();
    const firstEvent = eventBus.publish.mock.calls[0][0];
    expect(firstEvent).toBeInstanceOf(InventoryItemSyncedIntegrationEvent);
  });
});
