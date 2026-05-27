import { CreateInventoryConnectionUseCase } from '../application/use-cases/CreateInventoryConnectionUseCase';
import {
  IInventoryRepository,
  InventoryConnectionRecord,
} from '../domain/ports/IInventoryRepository';
import { IInventoryProviderFactory } from '../application/ports/IInventoryProvider';
import { IEventBus } from '@shared/application/ports/IEventBus';
import { InventoryDuplicateConnectionError } from '../domain/errors/InventoryDuplicateConnectionError';
import { InventoryConnectionCreatedIntegrationEvent } from '../application/integration-events/InventoryIntegrationEvents';

describe('CreateInventoryConnectionUseCase', () => {
  let useCase: CreateInventoryConnectionUseCase;
  let inventoryRepository: jest.Mocked<IInventoryRepository>;
  let eventBus: jest.Mocked<IEventBus>;
  let providerFactory: jest.Mocked<IInventoryProviderFactory>;

  const savedConnection = (): InventoryConnectionRecord => ({
    id: 'new-conn',
    tenantId: 'tenant-1',
    sourceType: 'ERP_SYNC',
    providerName: 'Bling Loja',
    status: 'ACTIVE',
    config: { accessToken: 'x' },
    lastSyncedAt: null,
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
      getConnection: jest.fn(),
      findConnectionByProvider: jest.fn(),
      markConnectionSyncedAt: jest.fn(),
    };

    eventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
      subscribe: jest.fn(),
    };

    providerFactory = {
      getProvider: jest.fn(),
    };

    useCase = new CreateInventoryConnectionUseCase(
      inventoryRepository,
      eventBus,
      providerFactory,
    );
  });

  it('INV-CONN-001: lança InventoryDuplicateConnectionError quando já existe mesma fonte + nome de provedor', async () => {
    inventoryRepository.findConnectionByProvider.mockResolvedValue(
      savedConnection(),
    );

    await expect(
      useCase.execute({
        tenantId: 'tenant-1',
        sourceType: 'ERP_SYNC',
        providerName: 'Bling Loja',
        config: {},
      }),
    ).rejects.toBeInstanceOf(InventoryDuplicateConnectionError);

    expect(inventoryRepository.createConnection).not.toHaveBeenCalled();
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it('INV-CONN-002: cria conexão e publica InventoryConnectionCreatedIntegrationEvent', async () => {
    inventoryRepository.findConnectionByProvider.mockResolvedValue(null);
    const created = savedConnection();
    inventoryRepository.createConnection.mockResolvedValue(created);

    providerFactory.getProvider.mockReturnValue({
      testConnection: jest.fn().mockResolvedValue(true),
      async *fetchStock() {
        yield [];
      },
    });

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      sourceType: 'ERP_SYNC',
      providerName: '  Bling Loja  ',
      config: { accessToken: 'x' },
    });

    expect(result.providerName).toBe('Bling Loja');
    expect(inventoryRepository.createConnection).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      sourceType: 'ERP_SYNC',
      providerName: 'Bling Loja',
      status: 'ACTIVE',
      config: { accessToken: 'x' },
    });

    expect(eventBus.publish).toHaveBeenCalledTimes(1);
    const published = eventBus.publish.mock.calls[0][0];
    expect(published).toBeInstanceOf(
      InventoryConnectionCreatedIntegrationEvent,
    );
    expect(published.payload).toMatchObject({
      connectionId: created.id,
      tenantId: created.tenantId,
      sourceType: created.sourceType,
      providerName: created.providerName,
    });
  });

  it('INV-CONN-003: falha em testConnection cria conexão com status FAILED', async () => {
    inventoryRepository.findConnectionByProvider.mockResolvedValue(null);
    inventoryRepository.createConnection.mockResolvedValue({
      ...savedConnection(),
      status: 'FAILED',
    });

    providerFactory.getProvider.mockReturnValue({
      testConnection: jest
        .fn()
        .mockRejectedValue(new Error('credencial inválida')),
      async *fetchStock() {
        yield [];
      },
    });

    await expect(
      useCase.execute({
        tenantId: 'tenant-1',
        sourceType: 'ERP_SYNC',
        config: { accessToken: 'bad' },
        providerName: 'Bling',
      }),
    ).resolves.toBeDefined();

    expect(providerFactory.getProvider).toHaveBeenCalledWith('ERP_SYNC');
    expect(inventoryRepository.createConnection).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'FAILED' }),
    );
  });

  it('INV-CONN-004: não tenta validar MANUAL_SNAPSHOT nem CSV_IMPORT e cria como ACTIVE', async () => {
    inventoryRepository.findConnectionByProvider.mockResolvedValue(null);
    inventoryRepository.createConnection.mockResolvedValue({
      ...savedConnection(),
      sourceType: 'MANUAL_SNAPSHOT',
    });

    await useCase.execute({
      tenantId: 'tenant-1',
      sourceType: 'MANUAL_SNAPSHOT',
      providerName: 'Planilha',
      config: { foo: 'bar' },
    });

    expect(providerFactory.getProvider).not.toHaveBeenCalled();
    expect(inventoryRepository.createConnection).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'ACTIVE' }),
    );
  });

  it('INV-CONN-005: credenciais válidas criam conexão com status ACTIVE', async () => {
    inventoryRepository.findConnectionByProvider.mockResolvedValue(null);
    inventoryRepository.createConnection.mockResolvedValue(savedConnection());

    providerFactory.getProvider.mockReturnValue({
      testConnection: jest.fn().mockResolvedValue(true),
      async *fetchStock() {
        yield [];
      },
    });

    await useCase.execute({
      tenantId: 'tenant-1',
      sourceType: 'ERP_SYNC',
      providerName: 'Bling',
      config: { accessToken: 'good' },
    });

    expect(inventoryRepository.createConnection).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'ACTIVE' }),
    );
  });
});
