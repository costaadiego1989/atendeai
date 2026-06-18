// ─── inventory.integration-new.spec.ts ─────────────────────────────────────────
// Integration tests for inventory module gaps.
// Uses in-memory repository, mocked Prisma, mocked queue, and NestJS TestingModule.
// No real DB connections. Covers module wiring, repo queries, service interactions,
// concurrent execution, and async job service gaps.

import { randomBytes } from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { AesGcmCredentialCipher } from '../infrastructure/security/AesGcmCredentialCipher';
import { PrismaInventoryRepository } from '../infrastructure/persistence/repositories/PrismaInventoryRepository';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { InventoryAsyncJobsService } from '../infrastructure/persistence/repositories/InventoryAsyncJobsService';
import { CreateInventoryConnectionUseCase } from '../application/use-cases/CreateInventoryConnectionUseCase';
import { SyncInventoryItemUseCase } from '../application/use-cases/SyncInventoryItemUseCase';
import { SyncInventoryConnectionUseCase } from '../application/use-cases/SyncInventoryConnectionUseCase';
import { GenerateInventoryReportUseCase } from '../application/use-cases/GenerateInventoryReportUseCase';
import { ListInventoryItemsUseCase } from '../application/use-cases/ListInventoryItemsUseCase';
import { ListInventoryConnectionsUseCase } from '../application/use-cases/ListInventoryConnectionsUseCase';
import { InventorySyncWorker } from '../application/workers/InventorySyncWorker';
import { InMemoryInventoryRepository } from './helpers/InMemoryInventoryRepository';
import { InMemoryEventBus } from './helpers/InMemoryEventBus';
import {
  IInventoryRepository,
  InventoryConnectionRecord,
  InventoryItemRecord,
} from '../domain/ports/IInventoryRepository';
import { IInventoryProviderFactory } from '../application/ports/IInventoryProvider';
import { IEventBus } from '@shared/application/ports/IEventBus';
import { InventoryDuplicateConnectionError } from '../domain/errors/InventoryDuplicateConnectionError';
import { InventoryConnectionNotFoundError } from '../domain/errors/InventoryConnectionNotFoundError';
import { InventoryInvalidSkuError } from '../domain/errors/InventoryInvalidSkuError';
import { InventoryCredentialDecryptionError } from '../domain/errors/InventoryCredentialDecryptionError';
import { EntityNotFoundException } from '@shared/domain/exceptions/DomainExceptions';
import {
  INVENTORY_REPOSITORY,
} from '../domain/ports/IInventoryRepository';
import { INVENTORY_PROVIDER_FACTORY } from '../application/ports/IInventoryProvider';
import { EVENT_BUS } from '@shared/application/ports/IEventBus';
import { INVENTORY_CREDENTIAL_CIPHER } from '../application/ports/ICredentialCipher';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ENV_KEY = 'INVENTORY_CONFIG_ENCRYPTION_KEY';
const originalEnvKey = process.env[ENV_KEY];

function setEncryptionKey() {
  process.env[ENV_KEY] = randomBytes(32).toString('hex');
}

function restoreEncryptionKey() {
  if (originalEnvKey === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = originalEnvKey;
}

function makeItem(overrides: Partial<InventoryItemRecord> = {}): InventoryItemRecord {
  return {
    id: 'item-1', tenantId: 'tenant-1', catalogItemId: null, sku: 'SKU-001',
    externalReference: null, name: 'Produto', availableQuantity: 10,
    availabilityStatus: 'AVAILABLE', currentPrice: '29.90', currency: 'BRL',
    source: 'BLING', lastSyncedAt: new Date(), createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  };
}

function makeMockedRepo(): jest.Mocked<IInventoryRepository> {
  return {
    syncItem: jest.fn(), listItems: jest.fn(), findItemBySku: jest.fn(),
    createConnection: jest.fn(), listConnections: jest.fn(), getConnection: jest.fn(),
    findConnectionByProvider: jest.fn(), markConnectionSyncedAt: jest.fn(),
  };
}

function makePrismaWithAsyncJob(overrides: Record<string, jest.Mock> = {}) {
  return {
    inventoryAsyncJob: {
      create: jest.fn(), update: jest.fn().mockResolvedValue({}),
      findMany: jest.fn(), findFirst: jest.fn(), ...overrides,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. PrismaInventoryRepository integration (Prisma mock — no real DB)
// ─────────────────────────────────────────────────────────────────────────────

describe('PrismaInventoryRepository – listItems integration via Prisma mock', () => {
  beforeAll(setEncryptionKey);
  afterAll(restoreEncryptionKey);

  function makeRepo() {
    const prisma = {
      inventoryItem: {
        upsert: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      inventoryConnection: {
        create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), updateMany: jest.fn(),
      },
    };
    const cipher = new AesGcmCredentialCipher();
    const repo = new PrismaInventoryRepository(prisma as unknown as PrismaService, cipher);
    return { prisma, repo };
  }

  it('INV-INT-REPO-001: listItems com tenantId scoped — only fetches items for that tenant', async () => {
    const { prisma, repo } = makeRepo();
    prisma.inventoryItem.findMany.mockResolvedValue([]);

    await repo.listItems({ tenantId: 'tenant-scoped-ABC' });

    const whereArg = prisma.inventoryItem.findMany.mock.calls[0][0].where;
    expect(whereArg.tenantId).toBe('tenant-scoped-ABC');
  });

  it('INV-INT-REPO-002: syncItem upsert create block includes all required fields', async () => {
    const { prisma, repo } = makeRepo();
    const now = new Date();
    prisma.inventoryItem.upsert.mockResolvedValue({
      id: 'i1', tenantId: 'tenant-1', catalogItemId: null, sku: 'S1',
      externalReference: null, name: 'P', availableQuantity: 5,
      availabilityStatus: 'AVAILABLE', currentPrice: null, currency: 'BRL',
      source: 'MANUAL_SNAPSHOT', lastSyncedAt: now, createdAt: now, updatedAt: now,
    });

    await repo.syncItem({
      tenantId: 'tenant-1', sku: 'S1', name: 'P',
      availableQuantity: 5, availabilityStatus: 'AVAILABLE',
    });

    const upsertArg = prisma.inventoryItem.upsert.mock.calls[0][0];
    expect(upsertArg.create.tenantId).toBe('tenant-1');
    expect(upsertArg.create.sku).toBe('S1');
    expect(upsertArg.create.name).toBe('P');
    expect(upsertArg.create.lastSyncedAt).toBeDefined();
  });

  it('INV-INT-REPO-003: syncItem upsert update block does NOT include tenantId (immutable)', async () => {
    const { prisma, repo } = makeRepo();
    const now = new Date();
    prisma.inventoryItem.upsert.mockResolvedValue({
      id: 'i1', tenantId: 'tenant-1', catalogItemId: null, sku: 'S1',
      externalReference: null, name: 'P', availableQuantity: 3,
      availabilityStatus: 'LOW_STOCK', currentPrice: null, currency: 'BRL',
      source: 'MANUAL_SNAPSHOT', lastSyncedAt: now, createdAt: now, updatedAt: now,
    });

    await repo.syncItem({ tenantId: 'tenant-1', sku: 'S1', name: 'P', availableQuantity: 3, availabilityStatus: 'LOW_STOCK' });

    const upsertArg = prisma.inventoryItem.upsert.mock.calls[0][0];
    expect(upsertArg.update.tenantId).toBeUndefined();
  });

  it('INV-INT-REPO-004: findItemBySku uses composite unique key tenantId_sku', async () => {
    const { prisma, repo } = makeRepo();
    prisma.inventoryItem.findUnique.mockResolvedValue(null);

    await repo.findItemBySku('tenant-1', 'MY-SKU');

    expect(prisma.inventoryItem.findUnique).toHaveBeenCalledWith({
      where: { tenantId_sku: { tenantId: 'tenant-1', sku: 'MY-SKU' } },
    });
  });

  it('INV-INT-REPO-005: listConnections WHERE includes tenantId to prevent cross-tenant leakage', async () => {
    const { prisma, repo } = makeRepo();
    prisma.inventoryConnection.findMany.mockResolvedValue([]);

    await repo.listConnections('tenant-ISOLATED');

    const whereArg = prisma.inventoryConnection.findMany.mock.calls[0][0].where;
    expect(whereArg.tenantId).toBe('tenant-ISOLATED');
  });

  it('INV-INT-REPO-006: findConnectionByProvider WHERE includes tenantId, sourceType, providerName', async () => {
    const { prisma, repo } = makeRepo();
    prisma.inventoryConnection.findFirst.mockResolvedValue(null);

    await repo.findConnectionByProvider('tenant-1', 'SHOPIFY', 'My Shop');

    const whereArg = prisma.inventoryConnection.findFirst.mock.calls[0][0].where;
    expect(whereArg.tenantId).toBe('tenant-1');
    expect(whereArg.sourceType).toBe('SHOPIFY');
    expect(whereArg.providerName.equals).toBe('My Shop');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. InMemoryInventoryRepository + UseCases integration
// ─────────────────────────────────────────────────────────────────────────────

describe('SyncInventoryItemUseCase + InMemoryInventoryRepository integration', () => {
  let repo: InMemoryInventoryRepository;
  let eventBus: InMemoryEventBus;
  let useCase: SyncInventoryItemUseCase;

  beforeEach(() => {
    repo = new InMemoryInventoryRepository();
    eventBus = new InMemoryEventBus();
    useCase = new SyncInventoryItemUseCase(repo, eventBus);
  });

  afterEach(() => {
    repo.clear();
    eventBus.reset();
  });

  it('INV-INT-SYNC-001: first sync creates item and publishes InventoryItemSyncedIntegrationEvent', async () => {
    await useCase.execute({
      tenantId: 'tenant-1', sku: 'INT-SKU-001', name: 'Produto Integrado',
      availableQuantity: 10, availabilityStatus: 'AVAILABLE', currentPrice: '19.90',
    });

    const item = await repo.findItemBySku('tenant-1', 'INT-SKU-001');
    expect(item).not.toBeNull();
    expect(item?.availableQuantity).toBe(10);

    const events = eventBus.published;
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0].constructor.name).toContain('Synced');
  });

  it('INV-INT-SYNC-002: second sync with same SKU updates existing item and preserves id', async () => {
    const first = await useCase.execute({
      tenantId: 'tenant-1', sku: 'INT-SKU-002', name: 'Produto',
      availableQuantity: 10, availabilityStatus: 'AVAILABLE',
    });

    const second = await useCase.execute({
      tenantId: 'tenant-1', sku: 'INT-SKU-002', name: 'Produto Atualizado',
      availableQuantity: 3, availabilityStatus: 'LOW_STOCK',
    });

    expect(second.id).toBe(first.id);
    expect(second.availableQuantity).toBe(3);
    expect(second.availabilityStatus).toBe('LOW_STOCK');
  });

  it('INV-INT-SYNC-003: items from different tenants are isolated', async () => {
    await useCase.execute({ tenantId: 'tenant-A', sku: 'SHARED-SKU', name: 'Prod A', availableQuantity: 5, availabilityStatus: 'AVAILABLE' });
    await useCase.execute({ tenantId: 'tenant-B', sku: 'SHARED-SKU', name: 'Prod B', availableQuantity: 99, availabilityStatus: 'AVAILABLE' });

    const itemA = await repo.findItemBySku('tenant-A', 'SHARED-SKU');
    const itemB = await repo.findItemBySku('tenant-B', 'SHARED-SKU');

    expect(itemA?.availableQuantity).toBe(5);
    expect(itemB?.availableQuantity).toBe(99);
    expect(itemA?.id).not.toBe(itemB?.id);
  });

  it('INV-INT-SYNC-004: negative quantity is clamped to 0 by InMemoryInventoryRepository', async () => {
    const result = await useCase.execute({
      tenantId: 'tenant-1', sku: 'NEG-SKU', name: 'Negative',
      availableQuantity: -100, availabilityStatus: 'UNAVAILABLE',
    });

    expect(result.availableQuantity).toBe(0);
  });

  it('INV-INT-SYNC-005: blank SKU throws InventoryInvalidSkuError before calling repo', async () => {
    await expect(
      useCase.execute({ tenantId: 'tenant-1', sku: '  ', name: 'Prod', availableQuantity: 0, availabilityStatus: 'AVAILABLE' }),
    ).rejects.toBeInstanceOf(InventoryInvalidSkuError);

    const items = await repo.listItems({ tenantId: 'tenant-1' });
    expect(items).toHaveLength(0);
  });
});

describe('CreateInventoryConnectionUseCase + InMemoryInventoryRepository integration', () => {
  let repo: InMemoryInventoryRepository;
  let eventBus: InMemoryEventBus;
  let useCase: CreateInventoryConnectionUseCase;

  beforeEach(() => {
    repo = new InMemoryInventoryRepository();
    eventBus = new InMemoryEventBus();
    const providerFactory: IInventoryProviderFactory = {
      getProvider: () => ({
        testConnection: jest.fn().mockResolvedValue(true),
        async *fetchStock() { yield []; },
      }),
    };
    useCase = new CreateInventoryConnectionUseCase(repo, eventBus, providerFactory);
  });

  afterEach(() => {
    repo.clear();
    eventBus.reset();
  });

  it('INV-INT-CREATE-001: first connection for a provider is created successfully', async () => {
    const result = await useCase.execute({
      tenantId: 'tenant-1', sourceType: 'ERP_SYNC', providerName: 'Bling ERP', config: { accessToken: 'tok' },
    });

    expect(result.id).toBeDefined();
    expect(result.tenantId).toBe('tenant-1');
    expect(result.sourceType).toBe('ERP_SYNC');
    expect(result.providerName).toBe('Bling ERP');
  });

  it('INV-INT-CREATE-002: duplicate connection throws InventoryDuplicateConnectionError', async () => {
    await useCase.execute({ tenantId: 'tenant-1', sourceType: 'ERP_SYNC', providerName: 'Bling', config: {} });

    await expect(
      useCase.execute({ tenantId: 'tenant-1', sourceType: 'ERP_SYNC', providerName: 'Bling', config: {} }),
    ).rejects.toBeInstanceOf(InventoryDuplicateConnectionError);
  });

  it('INV-INT-CREATE-003: same providerName for different tenants is allowed (no cross-tenant conflict)', async () => {
    const r1 = await useCase.execute({ tenantId: 'tenant-A', sourceType: 'ERP_SYNC', providerName: 'Bling', config: {} });
    const r2 = await useCase.execute({ tenantId: 'tenant-B', sourceType: 'ERP_SYNC', providerName: 'Bling', config: {} });

    expect(r1.tenantId).toBe('tenant-A');
    expect(r2.tenantId).toBe('tenant-B');
    expect(r1.id).not.toBe(r2.id);
  });

  it('INV-INT-CREATE-004: event published carries correct connectionId and tenantId', async () => {
    const result = await useCase.execute({ tenantId: 'tenant-1', sourceType: 'MANUAL_SNAPSHOT', providerName: 'Manual', config: {} });

    const events = eventBus.published;
    expect(events[0].payload.connectionId).toBe(result.id);
    expect(events[0].payload.tenantId).toBe('tenant-1');
  });

  it('INV-INT-CREATE-005: MANUAL_SNAPSHOT connection created with status ACTIVE without calling testConnection', async () => {
    const fakeFactory = { getProvider: jest.fn() };
    const uc = new CreateInventoryConnectionUseCase(repo, eventBus, fakeFactory);

    await uc.execute({ tenantId: 'tenant-1', sourceType: 'MANUAL_SNAPSHOT', providerName: 'M', config: {} });

    expect(fakeFactory.getProvider).not.toHaveBeenCalled();
    const connections = await repo.listConnections('tenant-1');
    expect(connections[0].status).toBe('ACTIVE');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. SyncInventoryConnectionUseCase integration
// ─────────────────────────────────────────────────────────────────────────────

describe('SyncInventoryConnectionUseCase + InMemoryInventoryRepository integration', () => {
  let repo: InMemoryInventoryRepository;
  let eventBus: InMemoryEventBus;
  let syncItemUseCase: SyncInventoryItemUseCase;

  beforeEach(() => {
    repo = new InMemoryInventoryRepository();
    eventBus = new InMemoryEventBus();
    syncItemUseCase = new SyncInventoryItemUseCase(repo, eventBus);
  });

  afterEach(() => {
    repo.clear();
    eventBus.reset();
  });

  function makeConnectionInRepo(sourceType = 'ERP_SYNC') {
    return repo.createConnection({
      tenantId: 'tenant-1', sourceType, providerName: 'TestProv',
      status: 'ACTIVE', config: { token: 'x' },
    });
  }

  function makeProvider(items: Array<{ sku: string; name: string; qty: number }>) {
    return {
      getProvider: () => ({
        testConnection: jest.fn(),
        async *fetchStock() {
          if (items.length > 0) yield items.map((i) => ({
            sku: i.sku, name: i.name, availableQuantity: i.qty,
            availabilityStatus: i.qty > 0 ? 'AVAILABLE' : 'UNAVAILABLE',
            externalReference: i.sku, currentPrice: '10.00', currency: 'BRL',
          }));
        },
      }),
    } as unknown as IInventoryProviderFactory;
  }

  it('INV-INT-SYNC-CONN-001: sync creates inventory items in the repository', async () => {
    const conn = await makeConnectionInRepo();
    const factory = makeProvider([{ sku: 'SYNC-A', name: 'Item A', qty: 5 }]);
    const uc = new SyncInventoryConnectionUseCase(repo, factory, syncItemUseCase);

    await uc.execute({ tenantId: 'tenant-1', connectionId: conn.id });

    const item = await repo.findItemBySku('tenant-1', 'SYNC-A');
    expect(item).not.toBeNull();
    expect(item?.availableQuantity).toBe(5);
  });

  it('INV-INT-SYNC-CONN-002: sync updates lastSyncedAt on connection', async () => {
    const conn = await makeConnectionInRepo();
    const factory = makeProvider([]);
    const uc = new SyncInventoryConnectionUseCase(repo, factory, syncItemUseCase);

    await uc.execute({ tenantId: 'tenant-1', connectionId: conn.id });

    const updated = await repo.getConnection('tenant-1', conn.id);
    expect(updated?.lastSyncedAt).not.toBeNull();
  });

  it('INV-INT-SYNC-CONN-003: connection from wrong tenant is not found (returns not found error)', async () => {
    const conn = await makeConnectionInRepo();
    const factory = makeProvider([]);
    const uc = new SyncInventoryConnectionUseCase(repo, factory, syncItemUseCase);

    await expect(
      uc.execute({ tenantId: 'tenant-OTHER', connectionId: conn.id }),
    ).rejects.toBeInstanceOf(InventoryConnectionNotFoundError);
  });

  it('INV-INT-SYNC-CONN-004: multiple items synced in one batch all appear in repo', async () => {
    const conn = await makeConnectionInRepo();
    const factory = makeProvider([
      { sku: 'S1', name: 'I1', qty: 10 },
      { sku: 'S2', name: 'I2', qty: 0 },
      { sku: 'S3', name: 'I3', qty: 3 },
    ]);
    const uc = new SyncInventoryConnectionUseCase(repo, factory, syncItemUseCase);

    await uc.execute({ tenantId: 'tenant-1', connectionId: conn.id });

    const items = await repo.listItems({ tenantId: 'tenant-1' });
    expect(items).toHaveLength(3);
  });

  it('INV-INT-SYNC-CONN-005: item with invalid SKU is skipped but sync completes', async () => {
    const conn = await makeConnectionInRepo();
    const factory: IInventoryProviderFactory = {
      getProvider: () => ({
        testConnection: jest.fn(),
        async *fetchStock() {
          yield [
            { sku: '', name: 'Bad', availableQuantity: 0, availabilityStatus: 'UNAVAILABLE', externalReference: null },
            { sku: 'VALID-SKU', name: 'Good', availableQuantity: 5, availabilityStatus: 'AVAILABLE', externalReference: 'ref-1' },
          ];
        },
      }),
    };
    const uc = new SyncInventoryConnectionUseCase(repo, factory, syncItemUseCase);

    await uc.execute({ tenantId: 'tenant-1', connectionId: conn.id });

    const items = await repo.listItems({ tenantId: 'tenant-1' });
    expect(items).toHaveLength(1);
    expect(items[0].sku).toBe('VALID-SKU');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. GenerateInventoryReportUseCase integration with InMemory repo
// ─────────────────────────────────────────────────────────────────────────────

describe('GenerateInventoryReportUseCase + InMemoryInventoryRepository integration', () => {
  let repo: InMemoryInventoryRepository;
  let eventBus: InMemoryEventBus;
  let syncItemUseCase: SyncInventoryItemUseCase;
  let reportUseCase: GenerateInventoryReportUseCase;

  beforeEach(() => {
    repo = new InMemoryInventoryRepository();
    eventBus = new InMemoryEventBus();
    syncItemUseCase = new SyncInventoryItemUseCase(repo, eventBus);
    reportUseCase = new GenerateInventoryReportUseCase(repo);
  });

  afterEach(() => {
    repo.clear();
    eventBus.reset();
  });

  async function seedItems() {
    await syncItemUseCase.execute({ tenantId: 'tenant-1', sku: 'R1', name: 'Cafe', availableQuantity: 10, availabilityStatus: 'AVAILABLE', currentPrice: '20.00' });
    await syncItemUseCase.execute({ tenantId: 'tenant-1', sku: 'R2', name: 'Arroz', availableQuantity: 2, availabilityStatus: 'LOW_STOCK', currentPrice: '10.00' });
    await syncItemUseCase.execute({ tenantId: 'tenant-1', sku: 'R3', name: 'Feijao', availableQuantity: 0, availabilityStatus: 'UNAVAILABLE', currentPrice: null as any });
  }

  it('INV-INT-REPORT-001: summary calculations are correct with actual seeded data', async () => {
    await seedItems();

    const result = await reportUseCase.execute({ tenantId: 'tenant-1' });

    expect(result.summary.totalItems).toBe(3);
    expect(result.summary.availableItems).toBe(1);
    expect(result.summary.lowStockItems).toBe(1);
    expect(result.summary.unavailableItems).toBe(1);
    expect(result.summary.totalQuantity).toBe(12);
    expect(result.summary.estimatedInventoryValue).toBe(10 * 20 + 2 * 10 + 0);
  });

  it('INV-INT-REPORT-002: item with null price contributes 0 to estimatedInventoryValue (no NaN)', async () => {
    await seedItems();

    const result = await reportUseCase.execute({ tenantId: 'tenant-1' });

    expect(Number.isNaN(result.summary.estimatedInventoryValue)).toBe(false);
    expect(result.summary.estimatedInventoryValue).toBeGreaterThanOrEqual(0);
  });

  it('INV-INT-REPORT-003: status filter AVAILABLE returns only available items', async () => {
    await seedItems();

    const result = await reportUseCase.execute({ tenantId: 'tenant-1', statuses: ['AVAILABLE'] });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].sku).toBe('R1');
  });

  it('INV-INT-REPORT-004: status filter [AVAILABLE, LOW_STOCK] returns combined set', async () => {
    await seedItems();

    const result = await reportUseCase.execute({ tenantId: 'tenant-1', statuses: ['AVAILABLE', 'LOW_STOCK'] });

    expect(result.items).toHaveLength(2);
    expect(result.items.map((i) => i.sku).sort()).toEqual(['R1', 'R2']);
  });

  it('INV-INT-REPORT-005: tenant isolation — tenant-B gets empty report when only tenant-1 has data', async () => {
    await seedItems();

    const result = await reportUseCase.execute({ tenantId: 'tenant-B' });

    expect(result.items).toHaveLength(0);
    expect(result.summary.totalItems).toBe(0);
  });

  it('INV-INT-REPORT-006: availableOnly filter only returns items with qty > 0', async () => {
    await seedItems();

    const result = await reportUseCase.execute({ tenantId: 'tenant-1', availableOnly: true });

    const unavailable = result.items.filter((i) => i.availabilityStatus === 'UNAVAILABLE');
    expect(unavailable).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. InventoryAsyncJobsService integration with Prisma mock
// ─────────────────────────────────────────────────────────────────────────────

describe('InventoryAsyncJobsService – integration with Prisma mock', () => {
  function makeJobRecord(overrides: Record<string, unknown> = {}) {
    return {
      id: 'job-1', tenantId: 'tenant-1', type: 'EXPORT_INVENTORY_REPORT_CSV',
      status: 'QUEUED', requestedByUserId: null, requestedByUserEmail: null,
      payload: {}, progress: 0, totalItems: 0, processedItems: 0, resultSummary: {},
      fileName: null, fileMimeType: null, fileUrl: null, fileContent: null,
      errorMessage: null, queueJobId: null,
      createdAt: new Date('2024-01-01'), updatedAt: new Date('2024-01-01'),
      completedAt: null, failedAt: null,
      ...overrides,
    };
  }

  it('INV-INT-JOBS-001: createJob with type SYNC_INVENTORY_CONNECTION stores correct type', async () => {
    const create = jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...makeJobRecord(), type: data.type, status: data.status }));
    const prisma = { inventoryAsyncJob: { create, update: jest.fn(), findMany: jest.fn(), findFirst: jest.fn() } } as unknown as PrismaService;
    const service = new InventoryAsyncJobsService(prisma);

    const result = await service.createJob({ tenantId: 'tenant-1', type: 'SYNC_INVENTORY_CONNECTION', payload: { connectionId: 'conn-1' } });

    expect(result.type).toBe('SYNC_INVENTORY_CONNECTION');
    expect(result.status).toBe('QUEUED');
  });

  it('INV-INT-JOBS-002: markProcessing sets status PROCESSING and progress', async () => {
    const update = jest.fn().mockResolvedValue(makeJobRecord({ status: 'PROCESSING', progress: 50 }));
    const prisma = { inventoryAsyncJob: { create: jest.fn(), update, findMany: jest.fn(), findFirst: jest.fn() } } as unknown as PrismaService;
    const service = new InventoryAsyncJobsService(prisma);

    await service.markProcessing('job-1', { progress: 50 });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'job-1' }, data: expect.objectContaining({ status: 'PROCESSING', progress: 50 }) }),
    );
  });

  it('INV-INT-JOBS-003: completeJob with fileUrl sets correct fields', async () => {
    const update = jest.fn().mockResolvedValue(makeJobRecord({ status: 'COMPLETED' }));
    const prisma = { inventoryAsyncJob: { create: jest.fn(), update, findMany: jest.fn(), findFirst: jest.fn() } } as unknown as PrismaService;
    const service = new InventoryAsyncJobsService(prisma);

    await service.completeJob('job-1', { fileUrl: 'https://s3.example.com/report.csv', processedItems: 50, totalItems: 50 });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'COMPLETED', fileUrl: 'https://s3.example.com/report.csv', progress: 100 }),
      }),
    );
  });

  it('INV-INT-JOBS-004: completeJob with fileContent (fallback) sets fileContent and no fileUrl', async () => {
    const update = jest.fn().mockResolvedValue(makeJobRecord({ status: 'COMPLETED' }));
    const prisma = { inventoryAsyncJob: { create: jest.fn(), update, findMany: jest.fn(), findFirst: jest.fn() } } as unknown as PrismaService;
    const service = new InventoryAsyncJobsService(prisma);

    await service.completeJob('job-1', { fileContent: 'csv-content', fileName: 'r.csv' });

    const dataArg = update.mock.calls[0][0].data;
    expect(dataArg.fileContent).toBe('csv-content');
    expect(dataArg.fileUrl).toBeNull();
  });

  it('INV-INT-JOBS-005: failJob sets errorMessage and status FAILED', async () => {
    const update = jest.fn().mockResolvedValue(makeJobRecord({ status: 'FAILED' }));
    const prisma = { inventoryAsyncJob: { create: jest.fn(), update, findMany: jest.fn(), findFirst: jest.fn() } } as unknown as PrismaService;
    const service = new InventoryAsyncJobsService(prisma);

    await service.failJob('job-1', 'Something broke');

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED', errorMessage: 'Something broke' }) }),
    );
  });

  it('INV-INT-JOBS-006: getJob scopes by tenantId — different tenant returns EntityNotFoundException', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const prisma = { inventoryAsyncJob: { create: jest.fn(), update: jest.fn(), findMany: jest.fn(), findFirst } } as unknown as PrismaService;
    const service = new InventoryAsyncJobsService(prisma);

    await expect(service.getJob('tenant-OTHER', 'job-1')).rejects.toBeInstanceOf(EntityNotFoundException);

    expect(findFirst).toHaveBeenCalledWith({ where: { id: 'job-1', tenantId: 'tenant-OTHER' } });
  });

  it('INV-INT-JOBS-007: getDownloadPayload query requires COMPLETED status to prevent PROCESSING download', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const prisma = { inventoryAsyncJob: { create: jest.fn(), update: jest.fn(), findMany: jest.fn(), findFirst } } as unknown as PrismaService;
    const service = new InventoryAsyncJobsService(prisma);

    await expect(service.getDownloadPayload('tenant-1', 'job-processing')).rejects.toBeInstanceOf(EntityNotFoundException);

    const whereArg = findFirst.mock.calls[0][0].where;
    expect(whereArg.status).toBe('COMPLETED');
    expect(whereArg.type).toBe('EXPORT_INVENTORY_REPORT_CSV');
  });

  it('INV-INT-JOBS-008: listJobs is ordered by createdAt desc with default limit 15', async () => {
    const findMany = jest.fn().mockResolvedValue([makeJobRecord(), makeJobRecord({ id: 'job-2' })]);
    const prisma = { inventoryAsyncJob: { create: jest.fn(), update: jest.fn(), findMany, findFirst: jest.fn() } } as unknown as PrismaService;
    const service = new InventoryAsyncJobsService(prisma);

    const result = await service.listJobs('tenant-1');

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: 'tenant-1' }, orderBy: { createdAt: 'desc' }, take: 15 }));
    expect(result).toHaveLength(2);
  });

  it('INV-INT-JOBS-009: getDownloadPayload returns fileUrl when set (redirect path)', async () => {
    const fileUrl = 'https://cdn.example.com/export.csv';
    const findFirst = jest.fn().mockResolvedValue(makeJobRecord({ status: 'COMPLETED', fileUrl, fileContent: null, fileName: 'export.csv', fileMimeType: 'text/csv' }));
    const prisma = { inventoryAsyncJob: { create: jest.fn(), update: jest.fn(), findMany: jest.fn(), findFirst } } as unknown as PrismaService;
    const service = new InventoryAsyncJobsService(prisma);

    const result = await service.getDownloadPayload('tenant-1', 'job-1');

    expect(result.fileUrl).toBe(fileUrl);
    expect(result.fileContent).toBeNull();
  });

  it('INV-INT-JOBS-010: attachQueueJobId updates the correct job record', async () => {
    const update = jest.fn().mockResolvedValue({});
    const prisma = { inventoryAsyncJob: { create: jest.fn(), update, findMany: jest.fn(), findFirst: jest.fn() } } as unknown as PrismaService;
    const service = new InventoryAsyncJobsService(prisma);

    await service.attachQueueJobId('job-abc', 'queue-job-123');

    expect(update).toHaveBeenCalledWith({ where: { id: 'job-abc' }, data: { queueJobId: 'queue-job-123' } });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Concurrent execution scenarios with InMemoryInventoryRepository
// ─────────────────────────────────────────────────────────────────────────────

describe('Concurrent execution – race condition scenarios', () => {
  let repo: InMemoryInventoryRepository;
  let eventBus: InMemoryEventBus;

  beforeEach(() => {
    repo = new InMemoryInventoryRepository();
    eventBus = new InMemoryEventBus();
  });

  afterEach(() => {
    repo.clear();
    eventBus.reset();
  });

  it('INV-INT-RACE-001: two concurrent SyncInventoryItemUseCase calls with same SKU result in one item (upsert semantics)', async () => {
    const uc = new SyncInventoryItemUseCase(repo, eventBus);

    await Promise.all([
      uc.execute({ tenantId: 'tenant-1', sku: 'RACE-SKU', name: 'A', availableQuantity: 10, availabilityStatus: 'AVAILABLE' }),
      uc.execute({ tenantId: 'tenant-1', sku: 'RACE-SKU', name: 'B', availableQuantity: 5, availabilityStatus: 'LOW_STOCK' }),
    ]);

    const items = await repo.listItems({ tenantId: 'tenant-1' });
    expect(items).toHaveLength(1);
    expect(items[0].sku).toBe('RACE-SKU');
  });

  it('INV-INT-RACE-002: two concurrent SyncInventoryItemUseCase calls for different SKUs both succeed', async () => {
    const uc = new SyncInventoryItemUseCase(repo, eventBus);

    await Promise.all([
      uc.execute({ tenantId: 'tenant-1', sku: 'SKU-A', name: 'A', availableQuantity: 10, availabilityStatus: 'AVAILABLE' }),
      uc.execute({ tenantId: 'tenant-1', sku: 'SKU-B', name: 'B', availableQuantity: 5, availabilityStatus: 'LOW_STOCK' }),
    ]);

    const items = await repo.listItems({ tenantId: 'tenant-1' });
    expect(items).toHaveLength(2);
  });

  it('INV-INT-RACE-003: two concurrent CreateInventoryConnectionUseCase calls for same provider may result in duplicate detection', async () => {
    const providerFactory: IInventoryProviderFactory = {
      getProvider: () => ({ testConnection: jest.fn().mockResolvedValue(true), async *fetchStock() { yield []; } }),
    };
    const uc = new CreateInventoryConnectionUseCase(repo, eventBus, providerFactory);

    // Run both concurrently — with InMemoryRepo, one should succeed and one may throw duplicate
    const results = await Promise.allSettled([
      uc.execute({ tenantId: 'tenant-1', sourceType: 'ERP_SYNC', providerName: 'Bling', config: {} }),
      uc.execute({ tenantId: 'tenant-1', sourceType: 'ERP_SYNC', providerName: 'Bling', config: {} }),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    // With real DB, a unique constraint would fire; with InMemory, race may produce 1 or 2
    expect(fulfilled.length + rejected.length).toBe(2);
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);
  });

  it('INV-INT-RACE-004: sequential CreateInventoryConnectionUseCase calls for same provider properly reject the second', async () => {
    const providerFactory: IInventoryProviderFactory = {
      getProvider: () => ({ testConnection: jest.fn().mockResolvedValue(true), async *fetchStock() { yield []; } }),
    };
    const uc = new CreateInventoryConnectionUseCase(repo, eventBus, providerFactory);

    await uc.execute({ tenantId: 'tenant-1', sourceType: 'SHOPIFY', providerName: 'ShopA', config: {} });

    await expect(
      uc.execute({ tenantId: 'tenant-1', sourceType: 'SHOPIFY', providerName: 'ShopA', config: {} }),
    ).rejects.toBeInstanceOf(InventoryDuplicateConnectionError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. AesGcmCredentialCipher + PrismaInventoryRepository encryption integration
// ─────────────────────────────────────────────────────────────────────────────

describe('AesGcmCredentialCipher + PrismaInventoryRepository encryption round-trip', () => {
  beforeAll(setEncryptionKey);
  afterAll(restoreEncryptionKey);

  function makeRepo() {
    const prisma = {
      inventoryConnection: { create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), updateMany: jest.fn() },
      inventoryItem: { upsert: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
    };
    const cipher = new AesGcmCredentialCipher();
    const repo = new PrismaInventoryRepository(prisma as unknown as PrismaService, cipher);
    return { prisma, repo, cipher };
  }

  it('INV-INT-ENC-001: accessToken is encrypted before being stored', async () => {
    const { prisma, repo } = makeRepo();
    prisma.inventoryConnection.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'c1', tenantId: 'tenant-1', sourceType: 'BLING', providerName: 'B', status: 'ACTIVE', config: data.config, lastSyncedAt: null, createdAt: new Date(), updatedAt: new Date() }),
    );

    await repo.createConnection({ tenantId: 'tenant-1', sourceType: 'BLING', providerName: 'B', status: 'ACTIVE', config: { accessToken: 'my-secret' } });

    const storedConfig = prisma.inventoryConnection.create.mock.calls[0][0].data.config;
    expect((storedConfig.accessToken as string).startsWith('v1:')).toBe(true);
    expect(storedConfig.accessToken).not.toBe('my-secret');
  });

  it('INV-INT-ENC-002: getConnection decrypts accessToken transparently', async () => {
    const { prisma, repo, cipher } = makeRepo();
    const encrypted = cipher.encrypt('my-secret');
    prisma.inventoryConnection.findFirst.mockResolvedValue({
      id: 'c1', tenantId: 'tenant-1', sourceType: 'BLING', providerName: 'B',
      status: 'ACTIVE', config: { accessToken: encrypted }, lastSyncedAt: null,
      createdAt: new Date(), updatedAt: new Date(),
    });

    const result = await repo.getConnection('tenant-1', 'c1');

    expect(result?.config.accessToken).toBe('my-secret');
  });

  it('INV-INT-ENC-003: tampered ciphertext in DB causes InventoryCredentialDecryptionError on getConnection', async () => {
    const { prisma, repo } = makeRepo();
    prisma.inventoryConnection.findFirst.mockResolvedValue({
      id: 'c1', tenantId: 'tenant-1', sourceType: 'BLING', providerName: 'B',
      status: 'ACTIVE', config: { accessToken: 'v1:dGFtcGVyZWQ=' }, lastSyncedAt: null,
      createdAt: new Date(), updatedAt: new Date(),
    });

    await expect(repo.getConnection('tenant-1', 'c1')).rejects.toBeInstanceOf(InventoryCredentialDecryptionError);
  });

  it('INV-INT-ENC-004: non-secret fields (shopUrl, providerName) are NOT encrypted', async () => {
    const { prisma, repo } = makeRepo();
    prisma.inventoryConnection.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'c1', tenantId: 'tenant-1', sourceType: 'SHOPIFY', providerName: 'S', status: 'ACTIVE', config: data.config, lastSyncedAt: null, createdAt: new Date(), updatedAt: new Date() }),
    );

    await repo.createConnection({
      tenantId: 'tenant-1', sourceType: 'SHOPIFY', providerName: 'S', status: 'ACTIVE',
      config: { accessToken: 'sec', shopUrl: 'https://loja.myshopify.com' },
    });

    const storedConfig = prisma.inventoryConnection.create.mock.calls[0][0].data.config;
    expect(storedConfig.shopUrl).toBe('https://loja.myshopify.com');
  });

  it('INV-INT-ENC-005: listConnections decrypts all connections in batch', async () => {
    const { prisma, repo, cipher } = makeRepo();
    const enc1 = cipher.encrypt('token-A');
    const enc2 = cipher.encrypt('token-B');
    prisma.inventoryConnection.findMany.mockResolvedValue([
      { id: 'c1', tenantId: 'tenant-1', sourceType: 'BLING', providerName: 'B1', status: 'ACTIVE', config: { accessToken: enc1 }, lastSyncedAt: null, createdAt: new Date(), updatedAt: new Date() },
      { id: 'c2', tenantId: 'tenant-1', sourceType: 'BLING', providerName: 'B2', status: 'ACTIVE', config: { accessToken: enc2 }, lastSyncedAt: null, createdAt: new Date(), updatedAt: new Date() },
    ]);

    const result = await repo.listConnections('tenant-1');

    expect(result[0].config.accessToken).toBe('token-A');
    expect(result[1].config.accessToken).toBe('token-B');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. ListInventoryConnectionsUseCase integration
// ─────────────────────────────────────────────────────────────────────────────

describe('ListInventoryConnectionsUseCase + InMemoryInventoryRepository integration', () => {
  let repo: InMemoryInventoryRepository;
  let useCase: ListInventoryConnectionsUseCase;

  beforeEach(() => {
    repo = new InMemoryInventoryRepository();
    useCase = new ListInventoryConnectionsUseCase(repo);
  });

  afterEach(() => { repo.clear(); });

  it('INV-INT-LIST-CONN-001: returns only connections for the given tenant', async () => {
    await repo.createConnection({ tenantId: 'tenant-A', sourceType: 'BLING', providerName: 'B1', status: 'ACTIVE', config: {} });
    await repo.createConnection({ tenantId: 'tenant-B', sourceType: 'BLING', providerName: 'B2', status: 'ACTIVE', config: {} });

    const result = await useCase.execute('tenant-A');

    expect(result).toHaveLength(1);
    expect(result[0].tenantId).toBe('tenant-A');
  });

  it('INV-INT-LIST-CONN-002: returns empty array when tenant has no connections', async () => {
    const result = await useCase.execute('tenant-no-connections');

    expect(result).toEqual([]);
  });

  it('INV-INT-LIST-CONN-003: returns all connection types for a tenant', async () => {
    await repo.createConnection({ tenantId: 'tenant-1', sourceType: 'BLING', providerName: 'Bling', status: 'ACTIVE', config: {} });
    await repo.createConnection({ tenantId: 'tenant-1', sourceType: 'SHOPIFY', providerName: 'Shop', status: 'ACTIVE', config: {} });
    await repo.createConnection({ tenantId: 'tenant-1', sourceType: 'MANUAL_SNAPSHOT', providerName: 'Manual', status: 'ACTIVE', config: {} });

    const result = await useCase.execute('tenant-1');

    expect(result).toHaveLength(3);
    expect(result.map((c) => c.sourceType).sort()).toEqual(['BLING', 'MANUAL_SNAPSHOT', 'SHOPIFY']);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. ListInventoryItemsUseCase integration
// ─────────────────────────────────────────────────────────────────────────────

describe('ListInventoryItemsUseCase + InMemoryInventoryRepository integration', () => {
  let repo: InMemoryInventoryRepository;
  let eventBus: InMemoryEventBus;
  let syncUseCase: SyncInventoryItemUseCase;
  let listUseCase: ListInventoryItemsUseCase;

  beforeEach(() => {
    repo = new InMemoryInventoryRepository();
    eventBus = new InMemoryEventBus();
    syncUseCase = new SyncInventoryItemUseCase(repo, eventBus);
    listUseCase = new ListInventoryItemsUseCase(repo);
  });

  afterEach(() => { repo.clear(); eventBus.reset(); });

  it('INV-INT-LIST-ITEMS-001: returns items for the correct tenant only', async () => {
    await syncUseCase.execute({ tenantId: 'tenant-A', sku: 'A1', name: 'ItemA', availableQuantity: 5, availabilityStatus: 'AVAILABLE' });
    await syncUseCase.execute({ tenantId: 'tenant-B', sku: 'B1', name: 'ItemB', availableQuantity: 3, availabilityStatus: 'AVAILABLE' });

    const result = await listUseCase.execute({ tenantId: 'tenant-A' });

    expect(result).toHaveLength(1);
    expect(result[0].sku).toBe('A1');
  });

  it('INV-INT-LIST-ITEMS-002: availableOnly filter excludes UNAVAILABLE items', async () => {
    await syncUseCase.execute({ tenantId: 'tenant-1', sku: 'AVAIL', name: 'Available', availableQuantity: 5, availabilityStatus: 'AVAILABLE' });
    await syncUseCase.execute({ tenantId: 'tenant-1', sku: 'UNAVAIL', name: 'Unavailable', availableQuantity: 0, availabilityStatus: 'UNAVAILABLE' });

    const result = await listUseCase.execute({ tenantId: 'tenant-1', availableOnly: true });

    expect(result.every((i) => i.availabilityStatus !== 'UNAVAILABLE')).toBe(true);
  });

  it('INV-INT-LIST-ITEMS-003: query filter matches by SKU case-insensitively', async () => {
    await syncUseCase.execute({ tenantId: 'tenant-1', sku: 'CAFE-001', name: 'Cafe', availableQuantity: 5, availabilityStatus: 'AVAILABLE' });
    await syncUseCase.execute({ tenantId: 'tenant-1', sku: 'ARROZ-001', name: 'Arroz', availableQuantity: 3, availabilityStatus: 'AVAILABLE' });

    const result = await listUseCase.execute({ tenantId: 'tenant-1', query: 'cafe' });

    expect(result).toHaveLength(1);
    expect(result[0].sku).toBe('CAFE-001');
  });

  it('INV-INT-LIST-ITEMS-004: query filter matches by item name', async () => {
    await syncUseCase.execute({ tenantId: 'tenant-1', sku: 'P1', name: 'Café Torrado', availableQuantity: 5, availabilityStatus: 'AVAILABLE' });
    await syncUseCase.execute({ tenantId: 'tenant-1', sku: 'P2', name: 'Arroz Branco', availableQuantity: 3, availabilityStatus: 'AVAILABLE' });

    const result = await listUseCase.execute({ tenantId: 'tenant-1', query: 'torrado' });

    expect(result).toHaveLength(1);
    expect(result[0].sku).toBe('P1');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. PrismaInventoryRepository – credential encryption with multiple providers
// ─────────────────────────────────────────────────────────────────────────────

describe('PrismaInventoryRepository – multi-provider credential encryption integration', () => {
  beforeAll(setEncryptionKey);
  afterAll(restoreEncryptionKey);

  const sourceTypesToTest = [
    { sourceType: 'SHOPIFY', secrets: ['accessToken'] },
    { sourceType: 'WOOCOMMERCE', secrets: ['consumerKey', 'consumerSecret'] },
    { sourceType: 'SHOPEE', secrets: ['partnerKey', 'accessToken'] },
    { sourceType: 'BLING', secrets: ['accessToken'] },
    { sourceType: 'TINY', secrets: ['token'] },
    { sourceType: 'NUVEMSHOP', secrets: ['accessToken'] },
    { sourceType: 'MERCADOLIVRE', secrets: ['accessToken'] },
  ];

  for (const { sourceType, secrets } of sourceTypesToTest) {
    it(`INV-INT-MULTI-ENC: ${sourceType} — all secret keys are encrypted before storage`, async () => {
      const prisma = {
        inventoryConnection: { create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), updateMany: jest.fn() },
        inventoryItem: { upsert: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
      };
      const config: Record<string, string> = {};
      for (const key of secrets) config[key] = `plain-${key}-value`;
      config.shopUrl = 'https://loja.com'; // non-secret

      prisma.inventoryConnection.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'cx', tenantId: 'tenant-1', sourceType, providerName: 'P', status: 'ACTIVE', config: data.config, lastSyncedAt: null, createdAt: new Date(), updatedAt: new Date() }),
      );

      const cipher = new AesGcmCredentialCipher();
      const repo = new PrismaInventoryRepository(prisma as unknown as PrismaService, cipher);
      await repo.createConnection({ tenantId: 'tenant-1', sourceType, providerName: 'P', status: 'ACTIVE', config });

      const storedConfig = prisma.inventoryConnection.create.mock.calls[0][0].data.config as Record<string, unknown>;
      for (const key of secrets) {
        expect((storedConfig[key] as string).startsWith('v1:')).toBe(true);
        expect(storedConfig[key]).not.toBe(`plain-${key}-value`);
      }
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. NestJS TestingModule – dependency injection wiring
// ─────────────────────────────────────────────────────────────────────────────

describe('NestJS TestingModule – use case injection via module', () => {
  beforeAll(setEncryptionKey);
  afterAll(restoreEncryptionKey);

  it('INV-INT-DI-001: SyncInventoryItemUseCase resolves correctly from TestingModule', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncInventoryItemUseCase,
        { provide: INVENTORY_REPOSITORY, useValue: makeMockedRepo() },
        { provide: EVENT_BUS, useValue: { publish: jest.fn().mockResolvedValue(undefined), subscribe: jest.fn() } },
      ],
    }).compile();

    const uc = module.get(SyncInventoryItemUseCase);
    expect(uc).toBeInstanceOf(SyncInventoryItemUseCase);
  });

  it('INV-INT-DI-002: GenerateInventoryReportUseCase resolves from TestingModule', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GenerateInventoryReportUseCase,
        { provide: INVENTORY_REPOSITORY, useValue: makeMockedRepo() },
      ],
    }).compile();

    const uc = module.get(GenerateInventoryReportUseCase);
    expect(uc).toBeInstanceOf(GenerateInventoryReportUseCase);
  });

  it('INV-INT-DI-003: CreateInventoryConnectionUseCase resolves from TestingModule', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateInventoryConnectionUseCase,
        { provide: INVENTORY_REPOSITORY, useValue: makeMockedRepo() },
        { provide: EVENT_BUS, useValue: { publish: jest.fn(), subscribe: jest.fn() } },
        { provide: INVENTORY_PROVIDER_FACTORY, useValue: { getProvider: jest.fn() } },
      ],
    }).compile();

    const uc = module.get(CreateInventoryConnectionUseCase);
    expect(uc).toBeInstanceOf(CreateInventoryConnectionUseCase);
  });

  it('INV-INT-DI-004: PrismaInventoryRepository resolves from TestingModule', async () => {
    const prisma = {
      inventoryConnection: { create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), updateMany: jest.fn() },
      inventoryItem: { upsert: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaInventoryRepository,
        { provide: PrismaService, useValue: prisma },
        { provide: INVENTORY_CREDENTIAL_CIPHER, useValue: new AesGcmCredentialCipher() },
      ],
    }).compile();

    const repo = module.get(PrismaInventoryRepository);
    expect(repo).toBeInstanceOf(PrismaInventoryRepository);
  });

  it('INV-INT-DI-005: InventoryAsyncJobsService resolves from TestingModule', async () => {
    const prisma = {
      inventoryAsyncJob: { create: jest.fn(), update: jest.fn(), findMany: jest.fn(), findFirst: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryAsyncJobsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    const service = module.get(InventoryAsyncJobsService);
    expect(service).toBeInstanceOf(InventoryAsyncJobsService);
  });

  it('INV-INT-DI-006: SyncInventoryConnectionUseCase resolves from TestingModule', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncInventoryConnectionUseCase,
        SyncInventoryItemUseCase,
        { provide: INVENTORY_REPOSITORY, useValue: makeMockedRepo() },
        { provide: EVENT_BUS, useValue: { publish: jest.fn(), subscribe: jest.fn() } },
        { provide: INVENTORY_PROVIDER_FACTORY, useValue: { getProvider: jest.fn() } },
      ],
    }).compile();

    const uc = module.get(SyncInventoryConnectionUseCase);
    expect(uc).toBeInstanceOf(SyncInventoryConnectionUseCase);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 12. InventoryFacade integration – repository delegation
// ─────────────────────────────────────────────────────────────────────────────

describe('InventoryFacade – repository delegation and error propagation', () => {
  it('INV-INT-FACADE-001: facade passes tenantId to repository listItems', async () => {
    const { InventoryFacade } = require('../application/facades/InventoryFacade');
    const repo = makeMockedRepo();
    repo.listItems.mockResolvedValue([]);
    const facade = new InventoryFacade(repo);

    await facade.listItems({ tenantId: 'tenant-facade-test' });

    expect(repo.listItems).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'tenant-facade-test' }));
  });

  it('INV-INT-FACADE-002: facade propagates repository error without catching', async () => {
    const { InventoryFacade } = require('../application/facades/InventoryFacade');
    const repo = makeMockedRepo();
    repo.listItems.mockRejectedValue(new Error('DB crash'));
    const facade = new InventoryFacade(repo);

    await expect(facade.listItems({ tenantId: 'tenant-1' })).rejects.toThrow('DB crash');
  });

  it('INV-INT-FACADE-003: facade returns items exactly as returned by repository', async () => {
    const { InventoryFacade } = require('../application/facades/InventoryFacade');
    const repo = makeMockedRepo();
    const items = [makeItem(), makeItem({ id: 'item-2', sku: 'SKU-002' })];
    repo.listItems.mockResolvedValue(items);
    const facade = new InventoryFacade(repo);

    const result = await facade.listItems({ tenantId: 'tenant-1' });

    expect(result).toBe(items);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 13. CreateInventoryConnectionUseCase – provider validation integration
// ─────────────────────────────────────────────────────────────────────────────

describe('CreateInventoryConnectionUseCase – provider validation integration with InMemory', () => {
  let repo: InMemoryInventoryRepository;
  let eventBus: InMemoryEventBus;

  beforeEach(() => {
    repo = new InMemoryInventoryRepository();
    eventBus = new InMemoryEventBus();
  });

  afterEach(() => { repo.clear(); eventBus.reset(); });

  it('INV-INT-PROV-001: provider testConnection throws → connection saved with FAILED status', async () => {
    const failingFactory: IInventoryProviderFactory = {
      getProvider: () => ({
        testConnection: jest.fn().mockRejectedValue(new Error('bad creds')),
        async *fetchStock() { yield []; },
      }),
    };
    const uc = new CreateInventoryConnectionUseCase(repo, eventBus, failingFactory);

    const result = await uc.execute({ tenantId: 'tenant-1', sourceType: 'ERP_SYNC', providerName: 'BadProv', config: { accessToken: 'bad' } });

    expect(result.status).toBe('FAILED');
  });

  it('INV-INT-PROV-002: provider testConnection succeeds → connection saved with ACTIVE status', async () => {
    const goodFactory: IInventoryProviderFactory = {
      getProvider: () => ({
        testConnection: jest.fn().mockResolvedValue(true),
        async *fetchStock() { yield []; },
      }),
    };
    const uc = new CreateInventoryConnectionUseCase(repo, eventBus, goodFactory);

    const result = await uc.execute({ tenantId: 'tenant-1', sourceType: 'ERP_SYNC', providerName: 'GoodProv', config: { accessToken: 'ok' } });

    expect(result.status).toBe('ACTIVE');
  });

  it('INV-INT-PROV-003: event is published on successful connection with correct payload', async () => {
    const goodFactory: IInventoryProviderFactory = {
      getProvider: () => ({
        testConnection: jest.fn().mockResolvedValue(true),
        async *fetchStock() { yield []; },
      }),
    };
    const uc = new CreateInventoryConnectionUseCase(repo, eventBus, goodFactory);

    const result = await uc.execute({ tenantId: 'tenant-1', sourceType: 'MANUAL_SNAPSHOT', providerName: 'Manual', config: {} });

    const events = eventBus.published;
    expect(events).toHaveLength(1);
    expect(events[0].payload.connectionId).toBe(result.id);
    expect(events[0].payload.tenantId).toBe('tenant-1');
  });

  it('INV-INT-PROV-004: event is still published even when provider test fails', async () => {
    const failFactory: IInventoryProviderFactory = {
      getProvider: () => ({
        testConnection: jest.fn().mockRejectedValue(new Error('timeout')),
        async *fetchStock() { yield []; },
      }),
    };
    const uc = new CreateInventoryConnectionUseCase(repo, eventBus, failFactory);
    await uc.execute({ tenantId: 'tenant-1', sourceType: 'ERP_SYNC', providerName: 'FailProv', config: {} });

    const events = eventBus.published;
    expect(events).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 14. SyncInventoryItemUseCase – event publishing integration
// ─────────────────────────────────────────────────────────────────────────────

describe('SyncInventoryItemUseCase – event bus integration', () => {
  let repo: InMemoryInventoryRepository;
  let eventBus: InMemoryEventBus;
  let uc: SyncInventoryItemUseCase;

  beforeEach(() => {
    repo = new InMemoryInventoryRepository();
    eventBus = new InMemoryEventBus();
    uc = new SyncInventoryItemUseCase(repo, eventBus);
  });

  afterEach(() => { repo.clear(); eventBus.reset(); });

  it('INV-INT-EVENT-001: UNAVAILABLE item emits both Synced and Unavailable events', async () => {
    await uc.execute({ tenantId: 't1', sku: 'S1', name: 'P', availableQuantity: 0, availabilityStatus: 'UNAVAILABLE' });

    const events = eventBus.published;
    const names = events.map((e) => e.constructor.name);
    expect(names).toContain('InventoryItemSyncedIntegrationEvent');
    expect(names).toContain('InventoryItemUnavailableIntegrationEvent');
  });

  it('INV-INT-EVENT-002: AVAILABLE item emits only Synced event (no unavailable, no price change)', async () => {
    await uc.execute({ tenantId: 't1', sku: 'S2', name: 'P', availableQuantity: 5, availabilityStatus: 'AVAILABLE', currentPrice: '10.00' });

    const events = eventBus.published;
    expect(events).toHaveLength(1);
    expect(events[0].constructor.name).toBe('InventoryItemSyncedIntegrationEvent');
  });

  it('INV-INT-EVENT-003: price change on second sync emits PriceChanged event', async () => {
    await uc.execute({ tenantId: 't1', sku: 'S3', name: 'P', availableQuantity: 5, availabilityStatus: 'AVAILABLE', currentPrice: '10.00' });
    eventBus.reset();

    await uc.execute({ tenantId: 't1', sku: 'S3', name: 'P', availableQuantity: 5, availabilityStatus: 'AVAILABLE', currentPrice: '20.00' });

    const events = eventBus.published;
    const priceChangedEvents = events.filter((e) => e.constructor.name.includes('PriceChanged'));
    expect(priceChangedEvents).toHaveLength(1);
    expect(priceChangedEvents[0].payload.previousPrice).toBe('10.00');
    expect(priceChangedEvents[0].payload.newPrice).toBe('20.00');
  });

  it('INV-INT-EVENT-004: no PriceChanged event when price stays the same on update', async () => {
    await uc.execute({ tenantId: 't1', sku: 'S4', name: 'P', availableQuantity: 5, availabilityStatus: 'AVAILABLE', currentPrice: '10.00' });
    eventBus.reset();

    await uc.execute({ tenantId: 't1', sku: 'S4', name: 'P', availableQuantity: 7, availabilityStatus: 'AVAILABLE', currentPrice: '10.00' });

    const priceChangedEvents = eventBus.published.filter((e) => e.constructor.name.includes('PriceChanged'));
    expect(priceChangedEvents).toHaveLength(0);
  });

  it('INV-INT-EVENT-005: synced event payload has correct sku and tenantId', async () => {
    await uc.execute({ tenantId: 'my-tenant', sku: 'MY-SKU', name: 'My Prod', availableQuantity: 3, availabilityStatus: 'LOW_STOCK' });

    const events = eventBus.published;
    const syncedEvent = events.find((e) => e.constructor.name === 'InventoryItemSyncedIntegrationEvent');
    expect(syncedEvent?.payload.sku).toBe('MY-SKU');
    expect(syncedEvent?.payload.tenantId).toBe('my-tenant');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 15. InventorySyncWorker – DB filtering integration
// ─────────────────────────────────────────────────────────────────────────────

describe('InventorySyncWorker – integration with Prisma mock', () => {
  it('INV-INT-WORKER-001: worker syncs only connections returned by Prisma findMany', async () => {
    const connections = [
      { id: 'conn-1', tenantId: 'tenant-1' },
      { id: 'conn-2', tenantId: 'tenant-2' },
      { id: 'conn-3', tenantId: 'tenant-3' },
    ];
    const findMany = jest.fn().mockResolvedValue(connections);
    const prisma = { inventoryConnection: { findMany } } as unknown as PrismaService;
    const syncExecute = jest.fn().mockResolvedValue(undefined);
    const syncUseCase = { execute: syncExecute } as unknown as SyncInventoryConnectionUseCase;
    const worker = new InventorySyncWorker(prisma, syncUseCase);

    await worker.handleHourlySync();

    expect(syncExecute).toHaveBeenCalledTimes(3);
    expect(syncExecute).toHaveBeenCalledWith({ tenantId: 'tenant-1', connectionId: 'conn-1' });
    expect(syncExecute).toHaveBeenCalledWith({ tenantId: 'tenant-2', connectionId: 'conn-2' });
    expect(syncExecute).toHaveBeenCalledWith({ tenantId: 'tenant-3', connectionId: 'conn-3' });
  });

  it('INV-INT-WORKER-002: Prisma findMany query uses { where: {} } — currently does not filter by status ACTIVE', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = { inventoryConnection: { findMany } } as unknown as PrismaService;
    const syncUseCase = { execute: jest.fn() } as unknown as SyncInventoryConnectionUseCase;
    const worker = new InventorySyncWorker(prisma, syncUseCase);

    await worker.handleHourlySync();

    // Document current behavior: no status filter
    expect(findMany.mock.calls[0][0].where).toEqual({});
  });

  it('INV-INT-WORKER-003: sync errors per connection are swallowed — overall handleHourlySync resolves', async () => {
    const findMany = jest.fn().mockResolvedValue([
      { id: 'c1', tenantId: 't1' },
      { id: 'c2', tenantId: 't2' },
    ]);
    const prisma = { inventoryConnection: { findMany } } as unknown as PrismaService;
    const syncExecute = jest.fn().mockRejectedValue(new Error('provider error'));
    const syncUseCase = { execute: syncExecute } as unknown as SyncInventoryConnectionUseCase;
    const worker = new InventorySyncWorker(prisma, syncUseCase);

    await expect(worker.handleHourlySync()).resolves.toBeUndefined();
    expect(syncExecute).toHaveBeenCalledTimes(2);
  });

  it('INV-INT-WORKER-004: DB failure in findMany is caught — handleHourlySync still resolves', async () => {
    const findMany = jest.fn().mockRejectedValue(new Error('DB timeout'));
    const prisma = { inventoryConnection: { findMany } } as unknown as PrismaService;
    const syncExecute = jest.fn();
    const syncUseCase = { execute: syncExecute } as unknown as SyncInventoryConnectionUseCase;
    const worker = new InventorySyncWorker(prisma, syncUseCase);

    await expect(worker.handleHourlySync()).resolves.toBeUndefined();
    expect(syncExecute).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 16. InMemoryInventoryRepository – direct unit tests
// ─────────────────────────────────────────────────────────────────────────────

describe('InMemoryInventoryRepository – direct tests', () => {
  let repo: InMemoryInventoryRepository;

  beforeEach(() => { repo = new InMemoryInventoryRepository(); });
  afterEach(() => { repo.clear(); });

  it('INV-INT-MEM-001: syncItem creates new item if not exists', async () => {
    const result = await repo.syncItem({ tenantId: 't1', sku: 'S1', name: 'P', availableQuantity: 5, availabilityStatus: 'AVAILABLE' });
    expect(result.id).toBeDefined();
    expect(result.sku).toBe('S1');
  });

  it('INV-INT-MEM-002: syncItem updates existing item preserving id', async () => {
    const first = await repo.syncItem({ tenantId: 't1', sku: 'S1', name: 'A', availableQuantity: 5, availabilityStatus: 'AVAILABLE' });
    const second = await repo.syncItem({ tenantId: 't1', sku: 'S1', name: 'B', availableQuantity: 0, availabilityStatus: 'UNAVAILABLE' });

    expect(second.id).toBe(first.id);
    expect(second.name).toBe('B');
    expect(second.availableQuantity).toBe(0);
  });

  it('INV-INT-MEM-003: findItemBySku returns null for missing sku', async () => {
    const result = await repo.findItemBySku('t1', 'NOT-EXIST');
    expect(result).toBeNull();
  });

  it('INV-INT-MEM-004: listItems filters correctly by availableOnly', async () => {
    await repo.syncItem({ tenantId: 't1', sku: 'A', name: 'A', availableQuantity: 5, availabilityStatus: 'AVAILABLE' });
    await repo.syncItem({ tenantId: 't1', sku: 'B', name: 'B', availableQuantity: 0, availabilityStatus: 'UNAVAILABLE' });

    const result = await repo.listItems({ tenantId: 't1', availableOnly: true });
    expect(result.every((i) => i.availabilityStatus !== 'UNAVAILABLE')).toBe(true);
  });

  it('INV-INT-MEM-005: clear removes all items and connections', async () => {
    await repo.syncItem({ tenantId: 't1', sku: 'S1', name: 'P', availableQuantity: 5, availabilityStatus: 'AVAILABLE' });
    await repo.createConnection({ tenantId: 't1', sourceType: 'BLING', providerName: 'B', status: 'ACTIVE', config: {} });
    repo.clear();

    const items = await repo.listItems({ tenantId: 't1' });
    const conns = await repo.listConnections('t1');
    expect(items).toHaveLength(0);
    expect(conns).toHaveLength(0);
  });

  it('INV-INT-MEM-006: markConnectionSyncedAt updates the lastSyncedAt field', async () => {
    const conn = await repo.createConnection({ tenantId: 't1', sourceType: 'BLING', providerName: 'B', status: 'ACTIVE', config: {} });
    const now = new Date();
    await repo.markConnectionSyncedAt('t1', conn.id, now);

    const updated = await repo.getConnection('t1', conn.id);
    expect(updated?.lastSyncedAt).toEqual(now);
  });

  it('INV-INT-MEM-007: getConnection returns null for wrong tenantId', async () => {
    const conn = await repo.createConnection({ tenantId: 't1', sourceType: 'BLING', providerName: 'B', status: 'ACTIVE', config: {} });
    const result = await repo.getConnection('t-wrong', conn.id);
    expect(result).toBeNull();
  });

  it('INV-INT-MEM-008: findConnectionByProvider is case-sensitive in InMemory impl', async () => {
    await repo.createConnection({ tenantId: 't1', sourceType: 'BLING', providerName: 'Bling Loja', status: 'ACTIVE', config: {} });

    const found = await repo.findConnectionByProvider('t1', 'BLING', 'Bling Loja');
    const notFound = await repo.findConnectionByProvider('t1', 'BLING', 'bling loja');

    expect(found).not.toBeNull();
    expect(notFound).toBeNull(); // InMemory is case-sensitive unlike Prisma
  });

  it('INV-INT-MEM-009: listItems query matches both by name and sku', async () => {
    await repo.syncItem({ tenantId: 't1', sku: 'CAFE-001', name: 'Arroz', availableQuantity: 5, availabilityStatus: 'AVAILABLE' });
    await repo.syncItem({ tenantId: 't1', sku: 'ARROZ-001', name: 'Cafe', availableQuantity: 3, availabilityStatus: 'AVAILABLE' });

    const bySku = await repo.listItems({ tenantId: 't1', query: 'cafe-001' });
    const byName = await repo.listItems({ tenantId: 't1', query: 'cafe' });

    expect(bySku).toHaveLength(1);
    expect(bySku[0].sku).toBe('CAFE-001');
    expect(byName.length).toBeGreaterThanOrEqual(1);
  });

  it('INV-INT-MEM-010: negative availableQuantity is clamped to 0 during syncItem', async () => {
    const result = await repo.syncItem({ tenantId: 't1', sku: 'NEG', name: 'Neg', availableQuantity: -50, availabilityStatus: 'UNAVAILABLE' });
    expect(result.availableQuantity).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 17. Additional repository and use-case edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe('PrismaInventoryRepository – markConnectionSyncedAt integration', () => {
  beforeAll(setEncryptionKey);
  afterAll(restoreEncryptionKey);

  it('INV-INT-SYNC-AT-001: markConnectionSyncedAt WHERE clause includes both id and tenantId', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      inventoryConnection: { create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), updateMany },
      inventoryItem: { upsert: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
    };
    const cipher = new AesGcmCredentialCipher();
    const repo = new PrismaInventoryRepository(prisma as unknown as PrismaService, cipher);
    const syncedAt = new Date();

    await repo.markConnectionSyncedAt('tenant-1', 'conn-1', syncedAt);

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'conn-1', tenantId: 'tenant-1' },
      data: { lastSyncedAt: syncedAt },
    });
  });

  it('INV-INT-SYNC-AT-002: markConnectionSyncedAt on non-existent connection does not throw', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 0 });
    const prisma = {
      inventoryConnection: { create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), updateMany },
      inventoryItem: { upsert: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
    };
    const cipher = new AesGcmCredentialCipher();
    const repo = new PrismaInventoryRepository(prisma as unknown as PrismaService, cipher);

    await expect(repo.markConnectionSyncedAt('tenant-1', 'non-existent', new Date())).resolves.not.toThrow();
  });
});

describe('ListInventoryConnectionsUseCase + mocked repo – error propagation', () => {
  it('INV-INT-LIST-CONN-ERR-001: throws when repo.listConnections rejects', async () => {
    const repo = makeMockedRepo();
    repo.listConnections.mockRejectedValue(new Error('DB error'));
    const uc = new ListInventoryConnectionsUseCase(repo);

    await expect(uc.execute('tenant-1')).rejects.toThrow('DB error');
  });

  it('INV-INT-LIST-CONN-ERR-002: passes tenantId to listConnections', async () => {
    const repo = makeMockedRepo();
    repo.listConnections.mockResolvedValue([]);
    const uc = new ListInventoryConnectionsUseCase(repo);

    await uc.execute('my-tenant');

    expect(repo.listConnections).toHaveBeenCalledWith('my-tenant');
  });

  it('INV-INT-LIST-CONN-ERR-003: returns empty array from repo unchanged', async () => {
    const repo = makeMockedRepo();
    repo.listConnections.mockResolvedValue([]);
    const uc = new ListInventoryConnectionsUseCase(repo);

    const result = await uc.execute('tenant-1');

    expect(result).toEqual([]);
  });

  it('INV-INT-LIST-CONN-ERR-004: returns connection array as-is without transformation', async () => {
    const conn: InventoryConnectionRecord = {
      id: 'c1', tenantId: 'tenant-1', sourceType: 'BLING', providerName: 'B',
      status: 'ACTIVE', config: { accessToken: 'tok' }, lastSyncedAt: null,
      createdAt: new Date(), updatedAt: new Date(),
    };
    const repo = makeMockedRepo();
    repo.listConnections.mockResolvedValue([conn]);
    const uc = new ListInventoryConnectionsUseCase(repo);

    const result = await uc.execute('tenant-1');

    expect(result[0].id).toBe('c1');
    expect(result[0].config.accessToken).toBe('tok');
  });

  it('INV-INT-LIST-CONN-ERR-005: multiple connections returned in order from repo', async () => {
    const conns: InventoryConnectionRecord[] = [
      { id: 'c1', tenantId: 'tenant-1', sourceType: 'BLING', providerName: 'B1', status: 'ACTIVE', config: {}, lastSyncedAt: null, createdAt: new Date(), updatedAt: new Date() },
      { id: 'c2', tenantId: 'tenant-1', sourceType: 'SHOPIFY', providerName: 'S1', status: 'ACTIVE', config: {}, lastSyncedAt: null, createdAt: new Date(), updatedAt: new Date() },
    ];
    const repo = makeMockedRepo();
    repo.listConnections.mockResolvedValue(conns);
    const uc = new ListInventoryConnectionsUseCase(repo);

    const result = await uc.execute('tenant-1');

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('c1');
    expect(result[1].id).toBe('c2');
  });
});


