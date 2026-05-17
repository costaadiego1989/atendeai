import { SyncInventoryConnectionUseCase } from '../application/use-cases/SyncInventoryConnectionUseCase';
import { SyncInventoryItemUseCase } from '../application/use-cases/SyncInventoryItemUseCase';
import { InMemoryInventoryRepository } from './helpers/InMemoryInventoryRepository';
import { InMemoryEventBus } from './helpers/InMemoryEventBus';
import {
  IInventoryProviderFactory,
  InventoryItemSnapshot,
} from '../application/ports/IInventoryProvider';
import { InventoryConnectionNotFoundError } from '../domain/errors/InventoryConnectionNotFoundError';

describe('SyncInventoryConnectionUseCase (integration)', () => {
  let repository: InMemoryInventoryRepository;
  let eventBus: InMemoryEventBus;
  let syncItemUseCase: SyncInventoryItemUseCase;
  let useCase: SyncInventoryConnectionUseCase;
  let providerFactory: jest.Mocked<IInventoryProviderFactory>;

  const TENANT = 'tenant-int-001';

  function makeProvider(batches: InventoryItemSnapshot[][]) {
    return {
      testConnection: jest.fn().mockResolvedValue(true),
      fetchStock: jest.fn().mockImplementation(async function* () {
        for (const batch of batches) {
          yield batch;
        }
      }),
    };
  }

  beforeEach(() => {
    repository = new InMemoryInventoryRepository();
    eventBus = new InMemoryEventBus();
    syncItemUseCase = new SyncInventoryItemUseCase(repository, eventBus);
    providerFactory = { getProvider: jest.fn() };
    useCase = new SyncInventoryConnectionUseCase(
      repository,
      providerFactory,
      syncItemUseCase as unknown as SyncInventoryItemUseCase,
    );
  });

  afterEach(() => {
    repository.clear();
    eventBus.reset();
  });

  async function seedConnection(
    overrides: {
      tenantId?: string;
      sourceType?: string;
      providerName?: string;
    } = {},
  ) {
    return repository.createConnection({
      tenantId: overrides.tenantId ?? TENANT,
      sourceType: overrides.sourceType ?? 'BLING',
      providerName: overrides.providerName ?? 'Bling Principal',
      config: { accessToken: 'tok-test' },
    });
  }

  // ─── INV-INT-001: persistência de itens ──────────────────────────────────

  it('INV-INT-001: sincroniza itens do provider e persiste no repositório', async () => {
    const conn = await seedConnection();
    const items: InventoryItemSnapshot[] = [
      {
        sku: 'INT-SKU-001',
        name: 'Produto A',
        availableQuantity: 10,
        availabilityStatus: 'AVAILABLE',
        currentPrice: '50.00',
      },
      {
        sku: 'INT-SKU-002',
        name: 'Produto B',
        availableQuantity: 0,
        availabilityStatus: 'UNAVAILABLE',
      },
    ];

    providerFactory.getProvider.mockReturnValue(makeProvider([items]));

    await useCase.execute({ tenantId: TENANT, connectionId: conn.id });

    const stored = await repository.listItems({ tenantId: TENANT });
    expect(stored).toHaveLength(2);
    expect(stored).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sku: 'INT-SKU-001',
          availableQuantity: 10,
          availabilityStatus: 'AVAILABLE',
        }),
        expect.objectContaining({
          sku: 'INT-SKU-002',
          availableQuantity: 0,
          availabilityStatus: 'UNAVAILABLE',
        }),
      ]),
    );
  });

  // ─── INV-INT-002: eventos publicados ─────────────────────────────────────

  it('INV-INT-002: publica inventory.item.synced.v1 e inventory.item.unavailable.v1 para itens zerados', async () => {
    const conn = await seedConnection();
    const items: InventoryItemSnapshot[] = [
      {
        sku: 'EVT-001',
        name: 'Disponível',
        availableQuantity: 5,
        availabilityStatus: 'AVAILABLE',
      },
      {
        sku: 'EVT-002',
        name: 'Zerado',
        availableQuantity: 0,
        availabilityStatus: 'UNAVAILABLE',
      },
    ];

    providerFactory.getProvider.mockReturnValue(makeProvider([items]));

    await useCase.execute({ tenantId: TENANT, connectionId: conn.id });

    expect(eventBus.getByEventName('inventory.item.synced.v1')).toHaveLength(2);
    const unavailable = eventBus.getByEventName(
      'inventory.item.unavailable.v1',
    );
    expect(unavailable).toHaveLength(1);
    expect(unavailable[0].payload).toMatchObject({
      tenantId: TENANT,
      sku: 'EVT-002',
    });
  });

  // ─── INV-INT-003: lastSyncedAt atualizado ────────────────────────────────

  it('INV-INT-003: atualiza lastSyncedAt da conexão após sync bem-sucedido', async () => {
    const conn = await seedConnection();
    providerFactory.getProvider.mockReturnValue(makeProvider([[]]));

    const before = Date.now();
    await useCase.execute({ tenantId: TENANT, connectionId: conn.id });

    const connections = await repository.listConnections(TENANT);
    const updated = connections.find((c) => c.id === conn.id);
    expect(updated?.lastSyncedAt).not.toBeNull();
    expect(updated?.lastSyncedAt!.getTime()).toBeGreaterThanOrEqual(before);
  });

  // ─── INV-INT-004: conexão não encontrada ─────────────────────────────────

  it('INV-INT-004: lança InventoryConnectionNotFoundError quando conexão não existe', async () => {
    await expect(
      useCase.execute({ tenantId: TENANT, connectionId: 'id-inexistente' }),
    ).rejects.toThrow(InventoryConnectionNotFoundError);
  });

  // ─── INV-INT-005: isolamento de tenant ───────────────────────────────────

  it('INV-INT-005: itens sincronizados ficam restritos ao tenant correto', async () => {
    const connA = await seedConnection();
    await seedConnection({ tenantId: 'tenant-B', providerName: 'Bling B' });

    const items: InventoryItemSnapshot[] = [
      {
        sku: 'ISO-001',
        name: 'Produto A',
        availableQuantity: 5,
        availabilityStatus: 'AVAILABLE',
      },
    ];
    providerFactory.getProvider.mockReturnValue(makeProvider([items]));

    await useCase.execute({ tenantId: TENANT, connectionId: connA.id });

    const itemsB = await repository.listItems({ tenantId: 'tenant-B' });
    expect(itemsB).toHaveLength(0);

    const itemsA = await repository.listItems({ tenantId: TENANT });
    expect(itemsA).toHaveLength(1);
  });

  // ─── INV-INT-006: múltiplos batches do generator ─────────────────────────

  it('INV-INT-006: processa múltiplos batches do AsyncGenerator e persiste todos os itens', async () => {
    const conn = await seedConnection();
    const batches: InventoryItemSnapshot[][] = [
      [
        {
          sku: 'BATCH-001',
          name: 'A',
          availableQuantity: 1,
          availabilityStatus: 'AVAILABLE',
        },
      ],
      [
        {
          sku: 'BATCH-002',
          name: 'B',
          availableQuantity: 2,
          availabilityStatus: 'AVAILABLE',
        },
      ],
      [
        {
          sku: 'BATCH-003',
          name: 'C',
          availableQuantity: 0,
          availabilityStatus: 'UNAVAILABLE',
        },
      ],
    ];
    providerFactory.getProvider.mockReturnValue(makeProvider(batches));

    await useCase.execute({ tenantId: TENANT, connectionId: conn.id });

    const stored = await repository.listItems({ tenantId: TENANT });
    expect(stored).toHaveLength(3);
  });

  // ─── INV-INT-007: erro no provider não atualiza lastSyncedAt ─────────────

  it('INV-INT-007: quando provider lança erro, lastSyncedAt não é atualizado', async () => {
    const conn = await seedConnection();
    const failingProvider = {
      testConnection: jest.fn().mockResolvedValue(true),
      fetchStock: jest.fn().mockImplementation(async function* () {
        throw new Error('Provider unavailable');

        yield [];
      }),
    };
    providerFactory.getProvider.mockReturnValue(failingProvider);

    await expect(
      useCase.execute({ tenantId: TENANT, connectionId: conn.id }),
    ).rejects.toThrow('Provider unavailable');

    const connections = await repository.listConnections(TENANT);
    const updated = connections.find((c) => c.id === conn.id);
    expect(updated?.lastSyncedAt).toBeNull();
  });

  // ─── INV-INT-008: item com SKU inválido ignorado ──────────────────────────

  it('INV-INT-008: item com SKU vazio é ignorado e demais itens são persistidos', async () => {
    const conn = await seedConnection();
    const items: InventoryItemSnapshot[] = [
      {
        sku: '',
        name: 'Sem SKU',
        availableQuantity: 1,
        availabilityStatus: 'AVAILABLE',
      },
      {
        sku: 'VALID-001',
        name: 'Válido',
        availableQuantity: 5,
        availabilityStatus: 'AVAILABLE',
      },
    ];
    providerFactory.getProvider.mockReturnValue(makeProvider([items]));

    await useCase.execute({ tenantId: TENANT, connectionId: conn.id });

    const stored = await repository.listItems({ tenantId: TENANT });
    expect(stored).toHaveLength(1);
    expect(stored[0].sku).toBe('VALID-001');
  });

  // ─── INV-INT-009: preço detectado muda publica inventory.price.changed.v1 ─

  it('INV-INT-009: segundo sync com preço diferente publica inventory.price.changed.v1', async () => {
    const conn = await seedConnection();
    const mkItem = (price: string): InventoryItemSnapshot[] => [
      {
        sku: 'PRICE-001',
        name: 'Produto Preço',
        availableQuantity: 5,
        availabilityStatus: 'AVAILABLE',
        currentPrice: price,
      },
    ];

    providerFactory.getProvider.mockReturnValue(
      makeProvider([mkItem('100.00')]),
    );
    await useCase.execute({ tenantId: TENANT, connectionId: conn.id });

    eventBus.reset();

    providerFactory.getProvider.mockReturnValue(
      makeProvider([mkItem('150.00')]),
    );
    await useCase.execute({ tenantId: TENANT, connectionId: conn.id });

    const priceEvents = eventBus.getByEventName('inventory.price.changed.v1');
    expect(priceEvents).toHaveLength(1);
    expect(priceEvents[0].payload).toMatchObject({
      sku: 'PRICE-001',
      previousPrice: '100.00',
      newPrice: '150.00',
    });
  });
});
