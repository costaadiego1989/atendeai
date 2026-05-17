import { SyncInventoryItemUseCase } from '../application/use-cases/SyncInventoryItemUseCase';
import {
  IInventoryRepository,
  InventoryItemRecord,
} from '../domain/ports/IInventoryRepository';
import { IEventBus } from '@shared/application/ports/IEventBus';
import {
  InventoryItemSyncedIntegrationEvent,
  InventoryItemUnavailableIntegrationEvent,
  InventoryPriceChangedIntegrationEvent,
} from '../application/integration-events/InventoryIntegrationEvents';

describe('SyncInventoryItemUseCase (extended)', () => {
  let useCase: SyncInventoryItemUseCase;
  let inventoryRepository: jest.Mocked<IInventoryRepository>;
  let eventBus: jest.Mocked<IEventBus>;

  const makeItem = (
    overrides: Partial<InventoryItemRecord> = {},
  ): InventoryItemRecord => ({
    id: 'item-1',
    tenantId: 'tenant-1',
    catalogItemId: null,
    sku: 'SKU-1',
    externalReference: null,
    name: 'Produto',
    availableQuantity: 5,
    availabilityStatus: 'AVAILABLE',
    currentPrice: '10.00',
    currency: 'BRL',
    source: 'BLING',
    lastSyncedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
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
    eventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
      subscribe: jest.fn(),
    };
    useCase = new SyncInventoryItemUseCase(inventoryRepository, eventBus);
  });

  it('should publish InventoryPriceChangedIntegrationEvent when price changes', async () => {
    const previousItem = makeItem({ currentPrice: '10.00' });
    const updatedItem = makeItem({ currentPrice: '15.00' });

    inventoryRepository.findItemBySku.mockResolvedValue(previousItem);
    inventoryRepository.syncItem.mockResolvedValue(updatedItem);

    await useCase.execute({
      tenantId: 'tenant-1',
      sku: 'SKU-1',
      name: 'Produto',
      availableQuantity: 5,
      availabilityStatus: 'AVAILABLE',
      currentPrice: '15.00',
    });

    const priceChangedCalls = eventBus.publish.mock.calls.filter(
      ([event]) => event instanceof InventoryPriceChangedIntegrationEvent,
    );
    expect(priceChangedCalls).toHaveLength(1);
    expect(priceChangedCalls[0][0].payload).toEqual(
      expect.objectContaining({
        previousPrice: '10.00',
        newPrice: '15.00',
      }),
    );
  });

  it('should publish InventoryItemUnavailableIntegrationEvent when quantity becomes 0', async () => {
    const updatedItem = makeItem({
      availableQuantity: 0,
      availabilityStatus: 'UNAVAILABLE',
    });

    inventoryRepository.findItemBySku.mockResolvedValue(null);
    inventoryRepository.syncItem.mockResolvedValue(updatedItem);

    await useCase.execute({
      tenantId: 'tenant-1',
      sku: 'SKU-1',
      name: 'Produto',
      availableQuantity: 0,
      availabilityStatus: 'UNAVAILABLE',
    });

    const unavailableCalls = eventBus.publish.mock.calls.filter(
      ([event]) => event instanceof InventoryItemUnavailableIntegrationEvent,
    );
    expect(unavailableCalls).toHaveLength(1);
    expect(unavailableCalls[0][0].payload).toEqual(
      expect.objectContaining({
        itemId: 'item-1',
        sku: 'SKU-1',
      }),
    );
  });

  it('should clamp negative quantity to 0', async () => {
    const savedItem = makeItem({ availableQuantity: 0 });
    inventoryRepository.findItemBySku.mockResolvedValue(null);
    inventoryRepository.syncItem.mockResolvedValue(savedItem);

    await useCase.execute({
      tenantId: 'tenant-1',
      sku: 'SKU-1',
      name: 'Produto',
      availableQuantity: -5,
      availabilityStatus: 'UNAVAILABLE',
    });

    expect(inventoryRepository.syncItem).toHaveBeenCalledWith(
      expect.objectContaining({
        availableQuantity: 0,
      }),
    );
  });

  it('should trim externalReference', async () => {
    const savedItem = makeItem({ externalReference: 'REF-123' });
    inventoryRepository.findItemBySku.mockResolvedValue(null);
    inventoryRepository.syncItem.mockResolvedValue(savedItem);

    await useCase.execute({
      tenantId: 'tenant-1',
      sku: 'SKU-1',
      name: 'Produto',
      availableQuantity: 5,
      availabilityStatus: 'AVAILABLE',
      externalReference: '  REF-123  ',
    });

    expect(inventoryRepository.syncItem).toHaveBeenCalledWith(
      expect.objectContaining({
        externalReference: 'REF-123',
      }),
    );
  });

  it('should update existing item (upsert behavior) and publish synced event', async () => {
    const existingItem = makeItem({ currentPrice: '10.00' });
    const updatedItem = makeItem({
      name: 'Produto Atualizado',
      currentPrice: '10.00',
    });

    inventoryRepository.findItemBySku.mockResolvedValue(existingItem);
    inventoryRepository.syncItem.mockResolvedValue(updatedItem);

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      sku: 'SKU-1',
      name: 'Produto Atualizado',
      availableQuantity: 5,
      availabilityStatus: 'AVAILABLE',
      currentPrice: '10.00',
    });

    expect(result).toEqual(updatedItem);
    expect(inventoryRepository.syncItem).toHaveBeenCalled();

    const syncedCalls = eventBus.publish.mock.calls.filter(
      ([event]) => event instanceof InventoryItemSyncedIntegrationEvent,
    );
    expect(syncedCalls).toHaveLength(1);
  });
});
