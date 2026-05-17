import { CreateInventoryConnectionUseCase } from '../application/use-cases/CreateInventoryConnectionUseCase';
import { InMemoryInventoryRepository } from './helpers/InMemoryInventoryRepository';
import { InMemoryEventBus } from './helpers/InMemoryEventBus';
import { InventoryDuplicateConnectionError } from '../domain/errors/InventoryDuplicateConnectionError';
import {
  IInventoryProviderFactory,
  IInventoryProvider,
} from '../application/ports/IInventoryProvider';

function makeProviderFactory(
  testConnectionFn?: () => Promise<boolean>,
): IInventoryProviderFactory {
  const provider: IInventoryProvider = {
    testConnection: testConnectionFn ?? jest.fn().mockResolvedValue(true),
    async *fetchStock() {
      /* no-op */
    },
  };
  return { getProvider: () => provider };
}

describe('CreateInventoryConnectionUseCase (integration)', () => {
  let useCase: CreateInventoryConnectionUseCase;
  let repository: InMemoryInventoryRepository;
  let eventBus: InMemoryEventBus;
  let providerFactory: IInventoryProviderFactory;

  beforeEach(() => {
    repository = new InMemoryInventoryRepository();
    eventBus = new InMemoryEventBus();
    providerFactory = makeProviderFactory();
    useCase = new CreateInventoryConnectionUseCase(
      repository,
      eventBus,
      providerFactory,
    );
  });

  afterEach(() => {
    repository.clear();
    eventBus.reset();
  });

  // ─── connection creation ─────────────────────────────────────────────────

  it('INV-T-071a: cria conexão e retorna registro com id, tenantId e status ACTIVE', async () => {
    const conn = await useCase.execute({
      tenantId: 'tenant-001',
      sourceType: 'BLING',
      providerName: 'Bling',
      config: { accessToken: 'tok' },
    });

    expect(conn.id).toBeDefined();
    expect(conn.tenantId).toBe('tenant-001');
    expect(conn.sourceType).toBe('BLING');
    expect(conn.providerName).toBe('Bling');
    expect(conn.status).toBe('ACTIVE');
  });

  // ─── duplicate detection ─────────────────────────────────────────────────

  it('INV-T-071b: segunda criação do mesmo provider/sourceType/tenant lança InventoryDuplicateConnectionError', async () => {
    const cmd = {
      tenantId: 'tenant-001',
      sourceType: 'BLING',
      providerName: 'Bling',
      config: { accessToken: 'tok' },
    };

    await useCase.execute(cmd);

    await expect(useCase.execute(cmd)).rejects.toThrow(
      InventoryDuplicateConnectionError,
    );
  });

  it('INV-T-071b2: mesmo provider em tenants diferentes não é considerado duplicata', async () => {
    const cmd = {
      sourceType: 'BLING',
      providerName: 'Bling',
      config: { accessToken: 'tok' },
    };

    const connA = await useCase.execute({ ...cmd, tenantId: 'tenant-A' });
    const connB = await useCase.execute({ ...cmd, tenantId: 'tenant-B' });

    expect(connA.id).not.toBe(connB.id);
  });

  // ─── event publication ────────────────────────────────────────────────────

  it('INV-T-071c: publica inventory.connection.created.v1 com connectionId, tenantId e providerName', async () => {
    const conn = await useCase.execute({
      tenantId: 'tenant-001',
      sourceType: 'SHOPIFY',
      providerName: 'Shopify',
      config: { shopUrl: 'https://x.myshopify.com', accessToken: 'tok' },
    });

    const events = eventBus.getByEventName('inventory.connection.created.v1');
    expect(events).toHaveLength(1);
    expect(events[0].payload).toMatchObject({
      connectionId: conn.id,
      tenantId: 'tenant-001',
      sourceType: 'SHOPIFY',
      providerName: 'Shopify',
    });
  });

  // ─── MANUAL_SNAPSHOT skips validation ────────────────────────────────────

  it('INV-T-071d: sourceType MANUAL_SNAPSHOT cria conexão sem chamar testConnection', async () => {
    const testConnectionSpy = jest.fn().mockResolvedValue(true);
    providerFactory = makeProviderFactory(testConnectionSpy);
    useCase = new CreateInventoryConnectionUseCase(
      repository,
      eventBus,
      providerFactory,
    );

    await useCase.execute({
      tenantId: 'tenant-001',
      sourceType: 'MANUAL_SNAPSHOT',
      providerName: 'Manual',
    });

    expect(testConnectionSpy).not.toHaveBeenCalled();
  });
});
