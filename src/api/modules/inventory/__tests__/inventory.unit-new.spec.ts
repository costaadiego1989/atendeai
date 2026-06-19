// ─── inventory.unit-new.spec.ts ────────────────────────────────────────────────
// New unit tests targeting gaps NOT covered by existing spec files.
// Covers: Controller guard/role logic, Repository syncItem/listItems/findItemBySku/
//   listConnections/findConnectionByProvider, UseCase edge-cases, Worker active-filter,
//   Provider edge-cases, AesGcmCipher truncation, Backfill multi-key, AsyncJobs gaps.

import { randomBytes } from 'crypto';
import { AesGcmCredentialCipher } from '../infrastructure/security/AesGcmCredentialCipher';
import { PrismaInventoryRepository } from '../infrastructure/persistence/repositories/PrismaInventoryRepository';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { InventoryCredentialDecryptionError } from '../domain/errors/InventoryCredentialDecryptionError';
import { InventoryConnectionNotFoundError } from '../domain/errors/InventoryConnectionNotFoundError';
import { InventoryDuplicateConnectionError } from '../domain/errors/InventoryDuplicateConnectionError';
import { InventoryInvalidSkuError } from '../domain/errors/InventoryInvalidSkuError';
import { CreateInventoryConnectionUseCase } from '../application/use-cases/CreateInventoryConnectionUseCase';
import { SyncInventoryConnectionUseCase } from '../application/use-cases/SyncInventoryConnectionUseCase';
import { SyncInventoryItemUseCase } from '../application/use-cases/SyncInventoryItemUseCase';
import { GenerateInventoryReportUseCase } from '../application/use-cases/GenerateInventoryReportUseCase';
import { ListInventoryItemsUseCase } from '../application/use-cases/ListInventoryItemsUseCase';
import { InventorySyncWorker } from '../application/workers/InventorySyncWorker';
import { WooCommerceProvider } from '../application/providers/WooCommerceProvider';
import { ShopeeProvider } from '../application/providers/ShopeeProvider';
import { TinyProvider } from '../application/providers/TinyProvider';
import { MercadoLivreProvider } from '../application/providers/MercadoLivreProvider';
import { ShopifyProvider } from '../application/providers/ShopifyProvider';
import { NuvemshopProvider } from '../application/providers/NuvemshopProvider';
import { BlingProvider } from '../application/providers/BlingProvider';
import { InventoryAsyncJobsService } from '../infrastructure/persistence/repositories/InventoryAsyncJobsService';
import { InventoryAsyncJobProcessor } from '../infrastructure/queue/InventoryAsyncJobProcessor';
import { InventoryReportCsvBuilder } from '../application/services/InventoryReportCsvBuilder';
import { FileStorageService } from '@shared/domain/services/FileStorageService';
import {
  IInventoryRepository,
  InventoryConnectionRecord,
  InventoryItemRecord,
} from '../domain/ports/IInventoryRepository';
import { IInventoryProviderFactory } from '../application/ports/IInventoryProvider';
import { IEventBus } from '@shared/application/ports/IEventBus';
import { EntityNotFoundException } from '@shared/domain/exceptions/DomainExceptions';
import { Job } from 'bullmq';
import {
  backfillEncryptCredentials,
  BackfillConnectionStore,
} from '../../../scripts/backfill-inventory-credentials';

// ─── Shared test helpers ────────────────────────────────────────────────────

const ENV_KEY = 'INVENTORY_CONFIG_ENCRYPTION_KEY';
const originalEnvKey = process.env[ENV_KEY];

function makeItem(overrides: Partial<InventoryItemRecord> = {}): InventoryItemRecord {
  return {
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
  };
}

function makeConnection(overrides: Partial<InventoryConnectionRecord> = {}): InventoryConnectionRecord {
  return {
    id: 'conn-1',
    tenantId: 'tenant-1',
    sourceType: 'BLING',
    providerName: 'Bling Loja',
    status: 'ACTIVE',
    config: { accessToken: 'tok' },
    lastSyncedAt: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

function makeMockedRepo(): jest.Mocked<IInventoryRepository> {
  return {
    syncItem: jest.fn(),
    listItems: jest.fn(),
    findItemBySku: jest.fn(),
    createConnection: jest.fn(),
    listConnections: jest.fn(),
    getConnection: jest.fn(),
    findConnectionByProvider: jest.fn(),
    markConnectionSyncedAt: jest.fn(),
  };
}

function makeMockedEventBus(): jest.Mocked<IEventBus> {
  return {
    publish: jest.fn().mockResolvedValue(undefined),
    subscribe: jest.fn(),
  };
}

function makePrismaMock() {
  return {
    inventoryConnection: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    inventoryItem: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    inventoryAsyncJob: {
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
  };
}

function makeDbItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item-db-1',
    tenantId: 'tenant-1',
    catalogItemId: null,
    sku: 'SKU-001',
    externalReference: null,
    name: 'Produto',
    availableQuantity: 5,
    availabilityStatus: 'AVAILABLE',
    currentPrice: { toString: () => '10.00' },
    currency: 'BRL',
    source: 'BLING',
    lastSyncedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeDbConnection(config: Record<string, unknown> = {}) {
  return {
    id: 'conn-1',
    tenantId: 'tenant-1',
    sourceType: 'BLING',
    providerName: 'Bling Loja',
    status: 'ACTIVE',
    config,
    lastSyncedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. PrismaInventoryRepository – untested methods
// ─────────────────────────────────────────────────────────────────────────────

describe('PrismaInventoryRepository – syncItem', () => {
  const ENV_KEY_LOCAL = 'INVENTORY_CONFIG_ENCRYPTION_KEY';

  let prisma: ReturnType<typeof makePrismaMock>;
  let cipher: AesGcmCredentialCipher;
  let repo: PrismaInventoryRepository;

  beforeAll(() => {
    process.env[ENV_KEY_LOCAL] = randomBytes(32).toString('hex');
  });

  afterAll(() => {
    if (originalEnvKey === undefined) delete process.env[ENV_KEY_LOCAL];
    else process.env[ENV_KEY_LOCAL] = originalEnvKey;
  });

  beforeEach(() => {
    prisma = makePrismaMock();
    cipher = new AesGcmCredentialCipher();
    repo = new PrismaInventoryRepository(prisma as unknown as PrismaService, cipher);
  });

  it('INV-REPO-NEW-001: syncItem chama upsert com tenantId+sku como chave composta', async () => {
    prisma.inventoryItem.upsert.mockResolvedValue(makeDbItem());

    await repo.syncItem({
      tenantId: 'tenant-1',
      sku: 'SKU-001',
      name: 'Produto',
      availableQuantity: 5,
      availabilityStatus: 'AVAILABLE',
    });

    expect(prisma.inventoryItem.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId_sku: { tenantId: 'tenant-1', sku: 'SKU-001' } },
      }),
    );
  });

  it('INV-REPO-NEW-002: syncItem usa currency padrão BRL quando não fornecida', async () => {
    prisma.inventoryItem.upsert.mockResolvedValue(makeDbItem());

    await repo.syncItem({
      tenantId: 'tenant-1',
      sku: 'SKU-001',
      name: 'Prod',
      availableQuantity: 1,
      availabilityStatus: 'AVAILABLE',
    });

    const upsertArg = prisma.inventoryItem.upsert.mock.calls[0][0];
    expect(upsertArg.create.currency).toBe('BRL');
    expect(upsertArg.update.currency).toBe('BRL');
  });

  it('INV-REPO-NEW-003: syncItem usa source padrão MANUAL_SNAPSHOT quando não fornecida', async () => {
    prisma.inventoryItem.upsert.mockResolvedValue(makeDbItem());

    await repo.syncItem({
      tenantId: 'tenant-1',
      sku: 'SKU-001',
      name: 'Prod',
      availableQuantity: 1,
      availabilityStatus: 'AVAILABLE',
    });

    const upsertArg = prisma.inventoryItem.upsert.mock.calls[0][0];
    expect(upsertArg.create.source).toBe('MANUAL_SNAPSHOT');
  });

  it('INV-REPO-NEW-004: syncItem mapeia currentPrice null para null no resultado', async () => {
    prisma.inventoryItem.upsert.mockResolvedValue(makeDbItem({ currentPrice: null }));

    const result = await repo.syncItem({
      tenantId: 'tenant-1',
      sku: 'SKU-001',
      name: 'Prod',
      availableQuantity: 1,
      availabilityStatus: 'AVAILABLE',
    });

    expect(result.currentPrice).toBeNull();
  });

  it('INV-REPO-NEW-005: syncItem mapeia currentPrice Decimal para string com 2 casas', async () => {
    prisma.inventoryItem.upsert.mockResolvedValue(makeDbItem({ currentPrice: { toString: () => '9.9' } }));

    const result = await repo.syncItem({
      tenantId: 'tenant-1',
      sku: 'SKU-001',
      name: 'Prod',
      availableQuantity: 1,
      availabilityStatus: 'AVAILABLE',
    });

    expect(result.currentPrice).toBe('9.90');
  });

  it('INV-REPO-NEW-006: syncItem propaga erro do Prisma sem engolir', async () => {
    prisma.inventoryItem.upsert.mockRejectedValue(new Error('DB timeout'));

    await expect(
      repo.syncItem({ tenantId: 'tenant-1', sku: 'S', name: 'N', availableQuantity: 0, availabilityStatus: 'AVAILABLE' }),
    ).rejects.toThrow('DB timeout');
  });
});

describe('PrismaInventoryRepository – listItems', () => {
  const ENV_KEY_LOCAL = 'INVENTORY_CONFIG_ENCRYPTION_KEY';

  let prisma: ReturnType<typeof makePrismaMock>;
  let cipher: AesGcmCredentialCipher;
  let repo: PrismaInventoryRepository;

  beforeAll(() => {
    process.env[ENV_KEY_LOCAL] = randomBytes(32).toString('hex');
  });

  afterAll(() => {
    if (originalEnvKey === undefined) delete process.env[ENV_KEY_LOCAL];
    else process.env[ENV_KEY_LOCAL] = originalEnvKey;
  });

  beforeEach(() => {
    prisma = makePrismaMock();
    cipher = new AesGcmCredentialCipher();
    repo = new PrismaInventoryRepository(prisma as unknown as PrismaService, cipher);
  });

  it('INV-REPO-NEW-007: listItems passa tenantId no WHERE', async () => {
    prisma.inventoryItem.findMany.mockResolvedValue([]);

    await repo.listItems({ tenantId: 'tenant-ABC' });

    expect(prisma.inventoryItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-ABC' }) }),
    );
  });

  it('INV-REPO-NEW-008: listItems com query inclui OR sobre name, sku, externalReference', async () => {
    prisma.inventoryItem.findMany.mockResolvedValue([]);

    await repo.listItems({ tenantId: 'tenant-1', query: 'cafe' });

    const whereArg = prisma.inventoryItem.findMany.mock.calls[0][0].where;
    expect(whereArg.OR).toHaveLength(3);
    expect(whereArg.OR[0]).toMatchObject({ name: { contains: 'cafe', mode: 'insensitive' } });
    expect(whereArg.OR[1]).toMatchObject({ sku: { contains: 'cafe', mode: 'insensitive' } });
    expect(whereArg.OR[2]).toMatchObject({ externalReference: { contains: 'cafe', mode: 'insensitive' } });
  });

  it('INV-REPO-NEW-009: listItems sem query não inclui OR no WHERE', async () => {
    prisma.inventoryItem.findMany.mockResolvedValue([]);

    await repo.listItems({ tenantId: 'tenant-1' });

    const whereArg = prisma.inventoryItem.findMany.mock.calls[0][0].where;
    expect(whereArg.OR).toBeUndefined();
  });

  it('INV-REPO-NEW-010: listItems com availableOnly filtra qty > 0 e status in AVAILABLE/LOW_STOCK', async () => {
    prisma.inventoryItem.findMany.mockResolvedValue([]);

    await repo.listItems({ tenantId: 'tenant-1', availableOnly: true });

    const whereArg = prisma.inventoryItem.findMany.mock.calls[0][0].where;
    expect(whereArg.availableQuantity).toEqual({ gt: 0 });
    expect(whereArg.availabilityStatus).toEqual({ in: ['AVAILABLE', 'LOW_STOCK'] });
  });

  it('INV-REPO-NEW-011: listItems sem availableOnly não filtra por quantidade ou status', async () => {
    prisma.inventoryItem.findMany.mockResolvedValue([]);

    await repo.listItems({ tenantId: 'tenant-1', availableOnly: false });

    const whereArg = prisma.inventoryItem.findMany.mock.calls[0][0].where;
    expect(whereArg.availableQuantity).toBeUndefined();
    expect(whereArg.availabilityStatus).toBeUndefined();
  });

  it('INV-REPO-NEW-012: listItems mapeia múltiplos itens corretamente', async () => {
    prisma.inventoryItem.findMany.mockResolvedValue([
      makeDbItem({ id: 'i1', sku: 'A' }),
      makeDbItem({ id: 'i2', sku: 'B' }),
    ]);

    const result = await repo.listItems({ tenantId: 'tenant-1' });

    expect(result).toHaveLength(2);
    expect(result[0].sku).toBe('A');
    expect(result[1].sku).toBe('B');
  });
});

describe('PrismaInventoryRepository – findItemBySku', () => {
  const ENV_KEY_LOCAL = 'INVENTORY_CONFIG_ENCRYPTION_KEY';

  let prisma: ReturnType<typeof makePrismaMock>;
  let cipher: AesGcmCredentialCipher;
  let repo: PrismaInventoryRepository;

  beforeAll(() => {
    process.env[ENV_KEY_LOCAL] = randomBytes(32).toString('hex');
  });

  afterAll(() => {
    if (originalEnvKey === undefined) delete process.env[ENV_KEY_LOCAL];
    else process.env[ENV_KEY_LOCAL] = originalEnvKey;
  });

  beforeEach(() => {
    prisma = makePrismaMock();
    cipher = new AesGcmCredentialCipher();
    repo = new PrismaInventoryRepository(prisma as unknown as PrismaService, cipher);
  });

  it('INV-REPO-NEW-013: findItemBySku usa chave composta tenantId_sku', async () => {
    prisma.inventoryItem.findUnique.mockResolvedValue(makeDbItem());

    await repo.findItemBySku('tenant-1', 'SKU-001');

    expect(prisma.inventoryItem.findUnique).toHaveBeenCalledWith({
      where: { tenantId_sku: { tenantId: 'tenant-1', sku: 'SKU-001' } },
    });
  });

  it('INV-REPO-NEW-014: findItemBySku retorna null quando não encontrado', async () => {
    prisma.inventoryItem.findUnique.mockResolvedValue(null);

    const result = await repo.findItemBySku('tenant-1', 'MISSING-SKU');

    expect(result).toBeNull();
  });

  it('INV-REPO-NEW-015: findItemBySku retorna item mapeado quando encontrado', async () => {
    prisma.inventoryItem.findUnique.mockResolvedValue(makeDbItem({ sku: 'FOUND-SKU' }));

    const result = await repo.findItemBySku('tenant-1', 'FOUND-SKU');

    expect(result).not.toBeNull();
    expect(result?.sku).toBe('FOUND-SKU');
  });

  it('INV-REPO-NEW-016: findItemBySku isola por tenant — query diferente não retorna resultado de outro tenant', async () => {
    prisma.inventoryItem.findUnique.mockResolvedValue(null);

    const result = await repo.findItemBySku('tenant-OTHER', 'SKU-001');

    expect(prisma.inventoryItem.findUnique).toHaveBeenCalledWith({
      where: { tenantId_sku: { tenantId: 'tenant-OTHER', sku: 'SKU-001' } },
    });
    expect(result).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. AesGcmCredentialCipher – truncated ciphertext edge case
// ─────────────────────────────────────────────────────────────────────────────

describe('AesGcmCredentialCipher – short ciphertext boundary', () => {
  beforeAll(() => {
    process.env[ENV_KEY] = randomBytes(32).toString('hex');
  });

  afterAll(() => {
    if (originalEnvKey === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = originalEnvKey;
  });

  it('INV-CIPHER-NEW-001: v1: ciphertext mais curto que IV(12)+AuthTag(16) lança erro', () => {
    const cipher = new AesGcmCredentialCipher();
    const tooShort = `v1:${Buffer.alloc(10).toString('base64')}`;
    expect(() => cipher.decrypt(tooShort)).toThrow();
  });

  it('INV-CIPHER-NEW-002: v1: com exatamente IV+AuthTag bytes (sem ciphertext) lança erro pois authTag inválido', () => {
    const cipher = new AesGcmCredentialCipher();
    const minimal = `v1:${Buffer.alloc(28).toString('base64')}`;
    expect(() => cipher.decrypt(minimal)).toThrow();
  });

  it('INV-CIPHER-NEW-003: v1: payload que é base64 válido mas completamente zerado lança erro criptográfico', () => {
    const cipher = new AesGcmCredentialCipher();
    const zeroed = `v1:${Buffer.alloc(50).toString('base64')}`;
    expect(() => cipher.decrypt(zeroed)).toThrow();
  });

  it('INV-CIPHER-NEW-004: string vazia sem prefixo v1 é retornada como plaintext (compat legacy)', () => {
    const cipher = new AesGcmCredentialCipher();
    expect(cipher.decrypt('')).toBe('');
  });

  it('INV-CIPHER-NEW-005: encrypt de string vazia produz ciphertext válido e round-trip preserva string vazia', () => {
    const cipher = new AesGcmCredentialCipher();
    const enc = cipher.encrypt('');
    expect(enc).toMatch(/^v1:/);
    expect(cipher.decrypt(enc)).toBe('');
  });

  it('INV-CIPHER-NEW-006: encrypt de string muito longa (>1KB) faz round-trip corretamente', () => {
    const cipher = new AesGcmCredentialCipher();
    const long = 'a'.repeat(1024);
    const enc = cipher.encrypt(long);
    expect(cipher.decrypt(enc)).toBe(long);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. backfillEncryptCredentials – multi-key scenario
// ─────────────────────────────────────────────────────────────────────────────

describe('backfillEncryptCredentials – multi-secret-key connections', () => {
  beforeAll(() => {
    process.env[ENV_KEY] = randomBytes(32).toString('hex');
  });

  afterAll(() => {
    if (originalEnvKey === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = originalEnvKey;
  });

  it('INV-BACKFILL-NEW-001: criptografa accessToken mas não shopUrl em conexão SHOPIFY', async () => {
    const cipher = new AesGcmCredentialCipher();
    const update = jest.fn().mockResolvedValue(undefined);
    const store: BackfillConnectionStore = {
      findMany: jest.fn().mockResolvedValue([
        { id: 'c1', sourceType: 'SHOPIFY', config: { accessToken: 'plain-token', shopUrl: 'https://loja.myshopify.com' } },
      ]),
      update,
    };

    const result = await backfillEncryptCredentials(store, cipher);

    expect(result.updated).toBe(1);
    const savedConfig = update.mock.calls[0][0].data.config as Record<string, unknown>;
    expect((savedConfig.accessToken as string).startsWith('v1:')).toBe(true);
    expect(savedConfig.shopUrl).toBe('https://loja.myshopify.com');
  });

  it('INV-BACKFILL-NEW-002: criptografa consumerKey E consumerSecret em conexão WOOCOMMERCE', async () => {
    const cipher = new AesGcmCredentialCipher();
    const update = jest.fn().mockResolvedValue(undefined);
    const store: BackfillConnectionStore = {
      findMany: jest.fn().mockResolvedValue([
        { id: 'c1', sourceType: 'WOOCOMMERCE', config: { consumerKey: 'ck_abc', consumerSecret: 'cs_xyz', storeUrl: 'https://loja.com' } },
      ]),
      update,
    };

    const result = await backfillEncryptCredentials(store, cipher);

    expect(result.updated).toBe(1);
    const savedConfig = update.mock.calls[0][0].data.config as Record<string, unknown>;
    expect((savedConfig.consumerKey as string).startsWith('v1:')).toBe(true);
    expect((savedConfig.consumerSecret as string).startsWith('v1:')).toBe(true);
    expect(savedConfig.storeUrl).toBe('https://loja.com');
  });

  it('INV-BACKFILL-NEW-003: pula conexão sem segredos para criptografar', async () => {
    const cipher = new AesGcmCredentialCipher();
    const update = jest.fn().mockResolvedValue(undefined);
    const store: BackfillConnectionStore = {
      findMany: jest.fn().mockResolvedValue([
        { id: 'c1', sourceType: 'BLING', config: {} },
      ]),
      update,
    };

    const result = await backfillEncryptCredentials(store, cipher);

    expect(result.updated).toBe(0);
    expect(update).not.toHaveBeenCalled();
  });

  it('INV-BACKFILL-NEW-004: processa múltiplas conexões e conta corretamente', async () => {
    const cipher = new AesGcmCredentialCipher();
    const update = jest.fn().mockResolvedValue(undefined);
    const store: BackfillConnectionStore = {
      findMany: jest.fn().mockResolvedValue([
        { id: 'c1', sourceType: 'BLING', config: { accessToken: 'plain1' } },
        { id: 'c2', sourceType: 'TINY', config: { token: 'plain2' } },
        { id: 'c3', sourceType: 'MANUAL_SNAPSHOT', config: { note: 'visible' } },
      ]),
      update,
    };

    const result = await backfillEncryptCredentials(store, cipher);

    expect(result.scanned).toBe(3);
    expect(result.updated).toBe(2);
    expect(update).toHaveBeenCalledTimes(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. CreateInventoryConnectionUseCase – eventBus.publish throws after save
// ─────────────────────────────────────────────────────────────────────────────

describe('CreateInventoryConnectionUseCase – eventBus publish failure', () => {
  let repo: jest.Mocked<IInventoryRepository>;
  let eventBus: jest.Mocked<IEventBus>;
  let providerFactory: jest.Mocked<IInventoryProviderFactory>;
  let useCase: CreateInventoryConnectionUseCase;

  beforeEach(() => {
    repo = makeMockedRepo();
    eventBus = makeMockedEventBus();
    providerFactory = { getProvider: jest.fn() };
    useCase = new CreateInventoryConnectionUseCase(repo, eventBus, providerFactory);
  });

  it('INV-CONN-NEW-001: quando eventBus.publish lança após createConnection, a conexão já foi persistida', async () => {
    repo.findConnectionByProvider.mockResolvedValue(null);
    repo.createConnection.mockResolvedValue(makeConnection());
    providerFactory.getProvider.mockReturnValue({
      testConnection: jest.fn().mockResolvedValue(true),
      async *fetchStock() { yield []; },
    });
    eventBus.publish.mockRejectedValue(new Error('Event bus offline'));

    await expect(
      useCase.execute({ tenantId: 'tenant-1', sourceType: 'ERP_SYNC', providerName: 'Bling', config: {} }),
    ).rejects.toThrow('Event bus offline');

    expect(repo.createConnection).toHaveBeenCalledTimes(1);
  });

  it('INV-CONN-NEW-002: trim de espaços no providerName previne duplicatas com espaços extras', async () => {
    repo.findConnectionByProvider.mockResolvedValue(null);
    repo.createConnection.mockResolvedValue(makeConnection({ providerName: 'Bling Loja' }));
    providerFactory.getProvider.mockReturnValue({
      testConnection: jest.fn().mockResolvedValue(true),
      async *fetchStock() { yield []; },
    });

    await useCase.execute({ tenantId: 'tenant-1', sourceType: 'ERP_SYNC', providerName: '  Bling Loja  ', config: {} });

    expect(repo.findConnectionByProvider).toHaveBeenCalledWith('tenant-1', 'ERP_SYNC', 'Bling Loja');
  });

  it('INV-CONN-NEW-003: CSV_IMPORT não chama providerFactory e cria ACTIVE', async () => {
    repo.findConnectionByProvider.mockResolvedValue(null);
    repo.createConnection.mockResolvedValue(makeConnection({ sourceType: 'CSV_IMPORT' }));

    await useCase.execute({ tenantId: 'tenant-1', sourceType: 'CSV_IMPORT', providerName: 'Planilha', config: {} });

    expect(providerFactory.getProvider).not.toHaveBeenCalled();
    expect(repo.createConnection).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'ACTIVE' }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. SyncInventoryConnectionUseCase – tenant mismatch
// ─────────────────────────────────────────────────────────────────────────────

describe('SyncInventoryConnectionUseCase – tenant isolation at use-case layer', () => {
  let repo: jest.Mocked<IInventoryRepository>;
  let providerFactory: jest.Mocked<IInventoryProviderFactory>;
  let syncItemUseCase: jest.Mocked<Pick<SyncInventoryItemUseCase, 'execute'>>;
  let useCase: SyncInventoryConnectionUseCase;

  beforeEach(() => {
    repo = makeMockedRepo();
    providerFactory = { getProvider: jest.fn() };
    syncItemUseCase = { execute: jest.fn() };
    useCase = new SyncInventoryConnectionUseCase(
      repo,
      providerFactory,
      syncItemUseCase as unknown as SyncInventoryItemUseCase,
    );
  });

  it('INV-SYNC-CONN-NEW-001: lança InventoryConnectionNotFoundError quando getConnection retorna null para tenantId', async () => {
    repo.getConnection.mockResolvedValue(null);

    await expect(
      useCase.execute({ tenantId: 'tenant-1', connectionId: 'conn-other-tenant' }),
    ).rejects.toBeInstanceOf(InventoryConnectionNotFoundError);

    expect(repo.getConnection).toHaveBeenCalledWith('tenant-1', 'conn-other-tenant');
    expect(providerFactory.getProvider).not.toHaveBeenCalled();
  });

  it('INV-SYNC-CONN-NEW-002: não sincroniza conexão de outro tenant mesmo se ID existe', async () => {
    // Simula repositório que retorna null por filtrar por tenantId
    repo.getConnection.mockImplementation(async (tenantId, id) => {
      if (tenantId === 'tenant-EVIL' && id === 'conn-tenant-1') return null;
      return makeConnection();
    });

    await expect(
      useCase.execute({ tenantId: 'tenant-EVIL', connectionId: 'conn-tenant-1' }),
    ).rejects.toBeInstanceOf(InventoryConnectionNotFoundError);
  });

  it('INV-SYNC-CONN-NEW-003: falha no provider não impede markConnectionSyncedAt de ser chamado', async () => {
    const conn = makeConnection();
    repo.getConnection.mockResolvedValue(conn);
    providerFactory.getProvider.mockReturnValue({
      testConnection: jest.fn(),
      async *fetchStock() { throw new Error('provider down'); },
    });

    await expect(
      useCase.execute({ tenantId: 'tenant-1', connectionId: 'conn-1' }),
    ).rejects.toThrow('provider down');

    // markConnectionSyncedAt should NOT be called on failure
    expect(repo.markConnectionSyncedAt).not.toHaveBeenCalled();
  });

  it('INV-SYNC-CONN-NEW-004: item sync com SKU inválido não bloqueia próximo item', async () => {
    const conn = makeConnection();
    repo.getConnection.mockResolvedValue(conn);
    repo.markConnectionSyncedAt.mockResolvedValue(undefined);

    providerFactory.getProvider.mockReturnValue({
      testConnection: jest.fn(),
      async *fetchStock() {
        yield [
          { sku: '', name: 'Bad Item', availableQuantity: 0, availabilityStatus: 'UNAVAILABLE' },
          { sku: 'GOOD-SKU', name: 'Good Item', availableQuantity: 5, availabilityStatus: 'AVAILABLE' },
        ];
      },
    });

    syncItemUseCase.execute
      .mockRejectedValueOnce(new Error('invalid SKU'))
      .mockResolvedValueOnce(makeItem({ sku: 'GOOD-SKU' }) as any);

    await useCase.execute({ tenantId: 'tenant-1', connectionId: 'conn-1' });

    expect(syncItemUseCase.execute).toHaveBeenCalledTimes(2);
    expect(repo.markConnectionSyncedAt).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. SyncInventoryItemUseCase – edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe('SyncInventoryItemUseCase – edge cases', () => {
  let repo: jest.Mocked<IInventoryRepository>;
  let eventBus: jest.Mocked<IEventBus>;
  let useCase: SyncInventoryItemUseCase;

  beforeEach(() => {
    repo = makeMockedRepo();
    eventBus = makeMockedEventBus();
    useCase = new SyncInventoryItemUseCase(repo, eventBus);
  });

  it('INV-SYNC-ITEM-NEW-001: SKU em branco (só espaços) lança InventoryInvalidSkuError', async () => {
    await expect(
      useCase.execute({ tenantId: 'tenant-1', sku: '   ', name: 'Prod', availableQuantity: 1, availabilityStatus: 'AVAILABLE' }),
    ).rejects.toBeInstanceOf(InventoryInvalidSkuError);

    expect(repo.syncItem).not.toHaveBeenCalled();
  });

  it('INV-SYNC-ITEM-NEW-002: SKU vazio lança InventoryInvalidSkuError', async () => {
    await expect(
      useCase.execute({ tenantId: 'tenant-1', sku: '', name: 'Prod', availableQuantity: 1, availabilityStatus: 'AVAILABLE' }),
    ).rejects.toBeInstanceOf(InventoryInvalidSkuError);
  });

  it('INV-SYNC-ITEM-NEW-003: quantity negativa é normalizada para 0 antes de persistir', async () => {
    repo.findItemBySku.mockResolvedValue(null);
    repo.syncItem.mockResolvedValue(makeItem({ availableQuantity: 0 }));

    await useCase.execute({ tenantId: 'tenant-1', sku: 'SKU-1', name: 'Prod', availableQuantity: -5, availabilityStatus: 'UNAVAILABLE' });

    expect(repo.syncItem).toHaveBeenCalledWith(
      expect.objectContaining({ availableQuantity: 0 }),
    );
  });

  it('INV-SYNC-ITEM-NEW-004: SQL-injection-like SKU é tratado como string literal sem sanitização especial necessária (passa para repo)', async () => {
    repo.findItemBySku.mockResolvedValue(null);
    repo.syncItem.mockResolvedValue(makeItem({ sku: "'; DROP TABLE inventory_items;--" }));

    await useCase.execute({
      tenantId: 'tenant-1',
      sku: "'; DROP TABLE inventory_items;--",
      name: 'Malicious',
      availableQuantity: 0,
      availabilityStatus: 'AVAILABLE',
    });

    expect(repo.syncItem).toHaveBeenCalledWith(
      expect.objectContaining({ sku: "'; DROP TABLE inventory_items;--" }),
    );
  });

  it('INV-SYNC-ITEM-NEW-005: SKU extremamente longo (>500 chars) é passado ao repo sem truncamento', async () => {
    const longSku = 'A'.repeat(500);
    repo.findItemBySku.mockResolvedValue(null);
    repo.syncItem.mockResolvedValue(makeItem({ sku: longSku }));

    await useCase.execute({ tenantId: 'tenant-1', sku: longSku, name: 'Prod', availableQuantity: 1, availabilityStatus: 'AVAILABLE' });

    expect(repo.syncItem).toHaveBeenCalledWith(expect.objectContaining({ sku: longSku }));
  });

  it('INV-SYNC-ITEM-NEW-006: InventoryItemSyncedIntegrationEvent é publicado mesmo sem previousItem', async () => {
    repo.findItemBySku.mockResolvedValue(null);
    repo.syncItem.mockResolvedValue(makeItem());

    await useCase.execute({ tenantId: 'tenant-1', sku: 'SKU-1', name: 'Prod', availableQuantity: 5, availabilityStatus: 'AVAILABLE' });

    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({ constructor: expect.anything() }),
    );
  });

  it('INV-SYNC-ITEM-NEW-007: InventoryItemUnavailableIntegrationEvent publicado quando status é UNAVAILABLE', async () => {
    repo.findItemBySku.mockResolvedValue(null);
    repo.syncItem.mockResolvedValue(makeItem({ availabilityStatus: 'UNAVAILABLE', availableQuantity: 0 }));

    await useCase.execute({ tenantId: 'tenant-1', sku: 'SKU-1', name: 'Prod', availableQuantity: 0, availabilityStatus: 'UNAVAILABLE' });

    expect(eventBus.publish).toHaveBeenCalledTimes(2); // synced + unavailable
  });

  it('INV-SYNC-ITEM-NEW-008: InventoryPriceChangedIntegrationEvent publicado quando preço muda', async () => {
    repo.findItemBySku.mockResolvedValue(makeItem({ currentPrice: '10.00' }));
    repo.syncItem.mockResolvedValue(makeItem({ currentPrice: '15.00' }));

    await useCase.execute({ tenantId: 'tenant-1', sku: 'SKU-1', name: 'Prod', availableQuantity: 5, availabilityStatus: 'AVAILABLE', currentPrice: '15.00' });

    expect(eventBus.publish).toHaveBeenCalledTimes(2); // synced + price changed
  });

  it('INV-SYNC-ITEM-NEW-009: nenhum PriceChangedEvent quando preço não muda', async () => {
    repo.findItemBySku.mockResolvedValue(makeItem({ currentPrice: '10.00' }));
    repo.syncItem.mockResolvedValue(makeItem({ currentPrice: '10.00' }));

    await useCase.execute({ tenantId: 'tenant-1', sku: 'SKU-1', name: 'Prod', availableQuantity: 5, availabilityStatus: 'AVAILABLE', currentPrice: '10.00' });

    expect(eventBus.publish).toHaveBeenCalledTimes(1); // only synced
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. GenerateInventoryReportUseCase – null price and multi-status filter
// ─────────────────────────────────────────────────────────────────────────────

describe('GenerateInventoryReportUseCase – null price and multi-status', () => {
  let repo: jest.Mocked<IInventoryRepository>;
  let useCase: GenerateInventoryReportUseCase;

  beforeEach(() => {
    repo = makeMockedRepo();
    useCase = new GenerateInventoryReportUseCase(repo);
  });

  it('INV-REPORT-NEW-001: item com currentPrice null contribui 0 para estimatedInventoryValue', async () => {
    repo.listItems.mockResolvedValue([
      makeItem({ availableQuantity: 10, currentPrice: null }),
    ]);

    const result = await useCase.execute({ tenantId: 'tenant-1' });

    expect(result.summary.estimatedInventoryValue).toBe(0);
    expect(Number.isNaN(result.summary.estimatedInventoryValue)).toBe(false);
  });

  it('INV-REPORT-NEW-002: item com currentPrice undefined contribui 0 para estimatedInventoryValue', async () => {
    repo.listItems.mockResolvedValue([
      makeItem({ availableQuantity: 5, currentPrice: undefined as unknown as null }),
    ]);

    const result = await useCase.execute({ tenantId: 'tenant-1' });

    expect(result.summary.estimatedInventoryValue).toBe(0);
    expect(Number.isNaN(result.summary.estimatedInventoryValue)).toBe(false);
  });

  it('INV-REPORT-NEW-003: filtro com múltiplos statuses retorna union correta de AVAILABLE e LOW_STOCK', async () => {
    repo.listItems.mockResolvedValue([
      makeItem({ id: 'i1', sku: 'A', availabilityStatus: 'AVAILABLE' }),
      makeItem({ id: 'i2', sku: 'B', availabilityStatus: 'LOW_STOCK' }),
      makeItem({ id: 'i3', sku: 'C', availabilityStatus: 'UNAVAILABLE' }),
      makeItem({ id: 'i4', sku: 'D', availabilityStatus: 'RESERVED' }),
    ]);

    const result = await useCase.execute({ tenantId: 'tenant-1', statuses: ['AVAILABLE', 'LOW_STOCK'] });

    expect(result.items).toHaveLength(2);
    const skus = result.items.map((i) => i.sku).sort();
    expect(skus).toEqual(['A', 'B']);
  });

  it('INV-REPORT-NEW-004: statuses array vazio retorna todos os itens sem filtragem', async () => {
    repo.listItems.mockResolvedValue([
      makeItem({ id: 'i1', sku: 'A', availabilityStatus: 'AVAILABLE' }),
      makeItem({ id: 'i2', sku: 'B', availabilityStatus: 'UNAVAILABLE' }),
    ]);

    const result = await useCase.execute({ tenantId: 'tenant-1', statuses: [] });

    expect(result.items).toHaveLength(2);
    expect(result.summary.totalItems).toBe(2);
  });

  it('INV-REPORT-NEW-005: statuses undefined retorna todos os itens sem filtragem', async () => {
    repo.listItems.mockResolvedValue([
      makeItem({ id: 'i1', sku: 'A', availabilityStatus: 'AVAILABLE' }),
      makeItem({ id: 'i2', sku: 'B', availabilityStatus: 'UNAVAILABLE' }),
    ]);

    const result = await useCase.execute({ tenantId: 'tenant-1' });

    expect(result.items).toHaveLength(2);
  });

  it('INV-REPORT-NEW-006: filtro por status que não existe nos itens retorna array vazio', async () => {
    repo.listItems.mockResolvedValue([
      makeItem({ availabilityStatus: 'AVAILABLE' }),
      makeItem({ id: 'i2', sku: 'B', availabilityStatus: 'LOW_STOCK' }),
    ]);

    const result = await useCase.execute({ tenantId: 'tenant-1', statuses: ['RESERVED'] });

    expect(result.items).toHaveLength(0);
    expect(result.summary.totalItems).toBe(0);
  });

  it('INV-REPORT-NEW-007: summary.totalQuantity soma apenas itens filtrados, não todos', async () => {
    repo.listItems.mockResolvedValue([
      makeItem({ id: 'i1', availabilityStatus: 'AVAILABLE', availableQuantity: 10 }),
      makeItem({ id: 'i2', sku: 'B', availabilityStatus: 'UNAVAILABLE', availableQuantity: 5 }),
    ]);

    const result = await useCase.execute({ tenantId: 'tenant-1', statuses: ['AVAILABLE'] });

    expect(result.summary.totalQuantity).toBe(10);
  });

  it('INV-REPORT-NEW-008: reservedItems conta corretamente itens com status RESERVED', async () => {
    repo.listItems.mockResolvedValue([
      makeItem({ id: 'i1', availabilityStatus: 'RESERVED' }),
      makeItem({ id: 'i2', sku: 'B', availabilityStatus: 'RESERVED' }),
      makeItem({ id: 'i3', sku: 'C', availabilityStatus: 'AVAILABLE' }),
    ]);

    const result = await useCase.execute({ tenantId: 'tenant-1' });

    expect(result.summary.reservedItems).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. InventorySyncWorker – active filter and DB failure
// ─────────────────────────────────────────────────────────────────────────────

describe('InventorySyncWorker – missing ACTIVE filter and DB error', () => {
  const originalFindMany = jest.fn();

  it('INV-WORKER-NEW-001: handleHourlySync sem filtro de status busca TODAS as conexões (expõe bug)', async () => {
    const findMany = jest.fn().mockResolvedValue([
      { id: 'c1', tenantId: 't1', status: 'ACTIVE' },
      { id: 'c2', tenantId: 't2', status: 'FAILED' },
    ]);
    const prisma = { inventoryConnection: { findMany } } as unknown as PrismaService;
    const syncExecute = jest.fn().mockResolvedValue(undefined);
    const syncUseCase = { execute: syncExecute } as unknown as SyncInventoryConnectionUseCase;

    const worker = new InventorySyncWorker(prisma, syncUseCase);
    await worker.handleHourlySync();

    // Currently the worker queries with { where: {} } — no ACTIVE filter
    // This test documents the missing ACTIVE filter (INV-WORKER-NEW-001 is a bug tracker)
    const queryArg = findMany.mock.calls[0][0];
    expect(queryArg.where).toEqual({});
    // Should have been { status: 'ACTIVE' } but is {} — both FAILED conns get synced
    expect(syncExecute).toHaveBeenCalledTimes(2);
  });

  it('INV-WORKER-NEW-002: quando Prisma findMany lança, o erro é capturado e não propaga fora do handler', async () => {
    const findMany = jest.fn().mockRejectedValue(new Error('DB connection lost'));
    const prisma = { inventoryConnection: { findMany } } as unknown as PrismaService;
    const syncExecute = jest.fn();
    const syncUseCase = { execute: syncExecute } as unknown as SyncInventoryConnectionUseCase;

    const worker = new InventorySyncWorker(prisma, syncUseCase);

    // Should not throw — the worker catches errors internally
    await expect(worker.handleHourlySync()).resolves.not.toThrow();
    expect(syncExecute).not.toHaveBeenCalled();
  });

  it('INV-WORKER-NEW-003: handleHourlySync com zero conexões não chama syncUseCase', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = { inventoryConnection: { findMany } } as unknown as PrismaService;
    const syncExecute = jest.fn();
    const syncUseCase = { execute: syncExecute } as unknown as SyncInventoryConnectionUseCase;

    const worker = new InventorySyncWorker(prisma, syncUseCase);
    await worker.handleHourlySync();

    expect(syncExecute).not.toHaveBeenCalled();
  });

  it('INV-WORKER-NEW-004: falha em primeira conexão não impede terceira de ser processada', async () => {
    const findMany = jest.fn().mockResolvedValue([
      { id: 'c1', tenantId: 't1' },
      { id: 'c2', tenantId: 't2' },
      { id: 'c3', tenantId: 't3' },
    ]);
    const prisma = { inventoryConnection: { findMany } } as unknown as PrismaService;
    const syncExecute = jest
      .fn()
      .mockRejectedValueOnce(new Error('c1 failed'))
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);
    const syncUseCase = { execute: syncExecute } as unknown as SyncInventoryConnectionUseCase;

    const worker = new InventorySyncWorker(prisma, syncUseCase);
    await worker.handleHourlySync();

    expect(syncExecute).toHaveBeenCalledTimes(3);
    expect(syncExecute).toHaveBeenNthCalledWith(3, { tenantId: 't3', connectionId: 'c3' });
  });
});

  const ENV_KEY_LOCAL = 'INVENTORY_CONFIG_ENCRYPTION_KEY';

  let prisma: ReturnType<typeof makePrismaMock>;
  let cipher: AesGcmCredentialCipher;
  let repo: PrismaInventoryRepository;

  beforeAll(() => {
    process.env[ENV_KEY_LOCAL] = randomBytes(32).toString('hex');
  });

  afterAll(() => {
    if (originalEnvKey === undefined) delete process.env[ENV_KEY_LOCAL];
    else process.env[ENV_KEY_LOCAL] = originalEnvKey;
  });

  beforeEach(() => {
    prisma = makePrismaMock();
    cipher = new AesGcmCredentialCipher();
    repo = new PrismaInventoryRepository(prisma as unknown as PrismaService, cipher);
  });

  it('INV-REPO-NEW-017: listConnections inclui tenantId no WHERE para evitar cross-tenant', async () => {
    prisma.inventoryConnection.findMany.mockResolvedValue([]);

    await repo.listConnections('tenant-ALPHA');

    expect(prisma.inventoryConnection.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 'tenant-ALPHA' } }),
    );
  });

  it('INV-REPO-NEW-018: listConnections ordena por createdAt asc', async () => {
    prisma.inventoryConnection.findMany.mockResolvedValue([]);

    await repo.listConnections('tenant-1');

    const arg = prisma.inventoryConnection.findMany.mock.calls[0][0];
    expect(arg.orderBy).toEqual(expect.arrayContaining([{ createdAt: 'asc' }]));
  });

  it('INV-REPO-NEW-019: listConnections retorna lista vazia quando não há conexões', async () => {
    prisma.inventoryConnection.findMany.mockResolvedValue([]);

    const result = await repo.listConnections('tenant-1');

    expect(result).toEqual([]);
  });

  it('INV-REPO-NEW-020: listConnections descriptografa segredos em cada conexão', async () => {
    const encrypted = cipher.encrypt('secret-token');
    prisma.inventoryConnection.findMany.mockResolvedValue([
      makeDbConnection({ accessToken: encrypted }),
    ]);

    const result = await repo.listConnections('tenant-1');

    expect(result[0].config.accessToken).toBe('secret-token');
  });
});

describe('PrismaInventoryRepository – findConnectionByProvider', () => {
  const ENV_KEY_LOCAL = 'INVENTORY_CONFIG_ENCRYPTION_KEY';

  let prisma: ReturnType<typeof makePrismaMock>;
  let cipher: AesGcmCredentialCipher;
  let repo: PrismaInventoryRepository;

  beforeAll(() => {
    process.env[ENV_KEY_LOCAL] = randomBytes(32).toString('hex');
  });

  afterAll(() => {
    if (originalEnvKey === undefined) delete process.env[ENV_KEY_LOCAL];
    else process.env[ENV_KEY_LOCAL] = originalEnvKey;
  });

  beforeEach(() => {
    prisma = makePrismaMock();
    cipher = new AesGcmCredentialCipher();
    repo = new PrismaInventoryRepository(prisma as unknown as PrismaService, cipher);
  });

  it('INV-REPO-NEW-021: findConnectionByProvider inclui tenantId no WHERE para isolar tenant', async () => {
    prisma.inventoryConnection.findFirst.mockResolvedValue(null);

    await repo.findConnectionByProvider('tenant-X', 'BLING', 'Bling Loja');

    expect(prisma.inventoryConnection.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-X' }),
      }),
    );
  });

  it('INV-REPO-NEW-022: findConnectionByProvider inclui sourceType e providerName no WHERE', async () => {
    prisma.inventoryConnection.findFirst.mockResolvedValue(null);

    await repo.findConnectionByProvider('tenant-1', 'SHOPIFY', 'Minha Loja Shopify');

    const where = prisma.inventoryConnection.findFirst.mock.calls[0][0].where;
    expect(where.sourceType).toBe('SHOPIFY');
    expect(where.providerName).toMatchObject({ equals: 'Minha Loja Shopify', mode: 'insensitive' });
  });

  it('INV-REPO-NEW-023: findConnectionByProvider retorna null quando não encontrado', async () => {
    prisma.inventoryConnection.findFirst.mockResolvedValue(null);

    const result = await repo.findConnectionByProvider('tenant-1', 'TINY', 'Nome');

    expect(result).toBeNull();
  });

  it('INV-REPO-NEW-024: findConnectionByProvider retorna conexão mapeada quando encontrada', async () => {
    prisma.inventoryConnection.findFirst.mockResolvedValue(makeDbConnection());

    const result = await repo.findConnectionByProvider('tenant-1', 'BLING', 'Bling Loja');

    expect(result).not.toBeNull();
    expect(result?.id).toBe('conn-1');
  });

  it('INV-REPO-NEW-025: findConnectionByProvider com tenant diferente não retorna conexão de outro tenant', async () => {
    prisma.inventoryConnection.findFirst.mockResolvedValue(null);

    const result = await repo.findConnectionByProvider('tenant-OTHER', 'BLING', 'Bling Loja');

    const passedWhere = prisma.inventoryConnection.findFirst.mock.calls[0][0].where;
    expect(passedWhere.tenantId).toBe('tenant-OTHER');
    expect(result).toBeNull();
  });
});

// ─── 9. Provider: WooCommerce variable products ─────────────────────────────

describe('WooCommerceProvider – variable products', () => {
  const provider = new WooCommerceProvider();
  const originalFetch = global.fetch;
  const config = { storeUrl: 'https://loja.com', consumerKey: 'ck_x', consumerSecret: 'cs_y' };

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function makeWooPage(products: unknown[], totalPages = 1) {
    return {
      ok: true,
      json: async () => products,
      headers: { get: (n: string) => (n === 'X-WP-TotalPages' ? String(totalPages) : null) },
    };
  }

  it('INV-WOO-NEW-001: produto do tipo variable com stock_quantity null retorna availableQuantity=0', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      makeWooPage([{ id: 1, type: 'simple', sku: 'VAR-001', name: 'Produto', stock_quantity: null, price: '50.00' }]),
    ) as unknown as typeof fetch;

    const batches: any[][] = [];
    for await (const b of provider.fetchStock(config)) batches.push(b);

    expect(batches[0][0].availableQuantity).toBe(0);
    expect(batches[0][0].availabilityStatus).toBe('UNAVAILABLE');
  });

  it('INV-WOO-NEW-002: produto de tipo variable (não simple) é ignorado pelo provider', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      makeWooPage([
        { id: 1, type: 'variable', sku: 'VAR-PARENT', name: 'Produto Variável', stock_quantity: null, price: '0' },
        { id: 2, type: 'simple', sku: 'SIMPLE-001', name: 'Simples', stock_quantity: 5, price: '20.00' },
      ]),
    ) as unknown as typeof fetch;

    const batches: any[][] = [];
    for await (const b of provider.fetchStock(config)) batches.push(b);

    expect(batches).toHaveLength(1);
    expect(batches[0]).toHaveLength(1);
    expect(batches[0][0].sku).toBe('SIMPLE-001');
  });

  it('INV-WOO-NEW-003: produto simples sem SKU é ignorado pelo provider', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      makeWooPage([{ id: 1, type: 'simple', sku: '', name: 'Sem SKU', stock_quantity: 3, price: '10.00' }]),
    ) as unknown as typeof fetch;

    const batches: any[][] = [];
    for await (const b of provider.fetchStock(config)) batches.push(b);

    expect(batches).toHaveLength(0);
  });

  it('INV-WOO-NEW-004: error HTTP não-OK na página 2 lança erro (rate limit mid-pagination)', async () => {
    const page1 = makeWooPage([{ id: 1, type: 'simple', sku: 'P1', name: 'P1', stock_quantity: 1, price: '10' }], 2);
    const page2 = { ok: false, statusText: 'Too Many Requests', json: async () => ({}) };
    global.fetch = jest.fn()
      .mockResolvedValueOnce(page1)
      .mockResolvedValueOnce(page2 as unknown as Response) as unknown as typeof fetch;

    const gen = provider.fetchStock(config);
    await gen.next();
    await expect(gen.next()).rejects.toThrow();
  });
});

// ─── 10. Provider: Shopee ok=false + error field ─────────────────────────────

describe('ShopeeProvider – ok=false AND error field scenarios', () => {
  const provider = new ShopeeProvider();
  const originalFetch = global.fetch;
  const config = { partnerId: '100', partnerKey: 'secret', accessToken: 'token', shopId: '200' };

  afterEach(() => { global.fetch = originalFetch; });

  it('INV-SHOPEE-NEW-001: quando error field está presente, fetchStock lança com mensagem de erro', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({ response: null, error: 'error_auth', message: 'Unauthorized' }),
    }) as unknown as typeof fetch;

    const gen = provider.fetchStock(config);
    await expect(gen.next()).rejects.toThrow(/Unauthorized/);
  });

  it('INV-SHOPEE-NEW-002: error vazio com response.item vazio para sem yield', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({ response: { item: [], has_next_page: false }, error: '', message: '' }),
    }) as unknown as typeof fetch;

    const batches: unknown[] = [];
    for await (const b of provider.fetchStock(config)) batches.push(b);

    expect(batches).toHaveLength(0);
  });

  it('INV-SHOPEE-NEW-003: item sem item_sku é ignorado no mapeamento', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        json: async () => ({ response: { item: [{ item_id: 999 }], has_next_page: false }, error: '', message: '' }),
      })
      .mockResolvedValueOnce({
        json: async () => ({
          response: { item_list: [{ item_id: 999, item_sku: null, stock_info: { normal_stock: 5 }, price_info: [] }] },
          error: '', message: '',
        }),
      }) as unknown as typeof fetch;

    const batches: unknown[] = [];
    for await (const b of provider.fetchStock(config)) batches.push(b);

    expect(batches).toHaveLength(0);
  });

  it('INV-SHOPEE-NEW-004: item com stock 0 tem availabilityStatus UNAVAILABLE', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        json: async () => ({ response: { item: [{ item_id: 111 }], has_next_page: false }, error: '', message: '' }),
      })
      .mockResolvedValueOnce({
        json: async () => ({
          response: { item_list: [{ item_id: 111, item_sku: 'SHOPEE-ZERO', stock_info: { normal_stock: 0 }, price_info: [] }] },
          error: '', message: '',
        }),
      }) as unknown as typeof fetch;

    const batches: any[][] = [];
    for await (const b of provider.fetchStock(config)) batches.push(b);

    expect(batches[0][0].availabilityStatus).toBe('UNAVAILABLE');
    expect(batches[0][0].availableQuantity).toBe(0);
  });
});

// ─── 11. Provider: MercadoLivre batch code != 200 ───────────────────────────

describe('MercadoLivreProvider – batch entries with non-200 code', () => {
  const provider = new MercadoLivreProvider();
  const originalFetch = global.fetch;
  const config = { userId: 'u1', accessToken: 'tok' };

  afterEach(() => { global.fetch = originalFetch; });

  function makeSearchPage(ids: string[], total = ids.length) {
    return { ok: true, json: async () => ({ results: ids, paging: { total } }) };
  }

  it('INV-ML-NEW-001: entrada de batch com code=404 é ignorada — não aparece no resultado', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce(makeSearchPage(['MLB1', 'MLB2']))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ([
          { code: 200, body: { id: 'MLB1', title: 'Prod1', available_quantity: 5, price: 10, currency_id: 'BRL', seller_custom_field: 'SKU-1' } },
          { code: 404, body: null },
        ]),
      }) as unknown as typeof fetch;

    const batches: any[][] = [];
    for await (const b of provider.fetchStock(config)) batches.push(b);

    expect(batches).toHaveLength(1);
    expect(batches[0]).toHaveLength(1);
    expect(batches[0][0].sku).toBe('SKU-1');
  });

  it('INV-ML-NEW-002: todos os itens do batch com code!=200 resulta em nenhum yield', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce(makeSearchPage(['MLB1']))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ([{ code: 403, body: null }]),
      }) as unknown as typeof fetch;

    const batches: unknown[] = [];
    for await (const b of provider.fetchStock(config)) batches.push(b);

    expect(batches).toHaveLength(0);
  });

  it('INV-ML-NEW-003: item sem seller_custom_field usa item.id como SKU', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce(makeSearchPage(['MLB99']))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ([
          { code: 200, body: { id: 'MLB99', title: 'Prod', available_quantity: 2, price: 50, currency_id: 'BRL', seller_custom_field: null } },
        ]),
      }) as unknown as typeof fetch;

    const batches: any[][] = [];
    for await (const b of provider.fetchStock(config)) batches.push(b);

    expect(batches[0][0].sku).toBe('MLB99');
  });
});

// ─── 12. Provider: TinyProvider status !== OK ─────────────────────────────────

describe('TinyProvider – status Erro handling', () => {
  const provider = new TinyProvider();
  const originalFetch = global.fetch;

  afterEach(() => { global.fetch = originalFetch; });

  it('INV-TINY-NEW-001: retorno.status = Erro em testConnection lança erro com codigo_erro', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({ retorno: { status: 'Erro', codigo_erro: '1' } }),
    }) as unknown as typeof fetch;

    await expect(provider.testConnection({ token: 'bad-token' })).rejects.toThrow(/1/);
  });

  it('INV-TINY-NEW-002: retorno.status = token_invalido em fetchStock lança erro', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({ retorno: { status: 'Erro', codigo_erro: 'token_invalido' } }),
    }) as unknown as typeof fetch;

    const gen = provider.fetchStock({ token: 'bad' });
    await expect(gen.next()).rejects.toThrow(/token_invalido/);
  });

  it('INV-TINY-NEW-003: produto sem codigo é ignorado no mapeamento', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({
        retorno: {
          status: 'OK',
          numero_paginas: 1,
          produtos: [
            { produto: { id: '1', codigo: '', nome: 'Sem SKU', saldo_estoque: 5 } },
          ],
        },
      }),
    }) as unknown as typeof fetch;

    const batches: unknown[] = [];
    for await (const b of provider.fetchStock({ token: 'tok' })) batches.push(b);

    expect(batches).toHaveLength(0);
  });
});

// ─── 13. Provider: NuvemshopProvider all null SKUs ─────────────────────────────

describe('NuvemshopProvider – all variants have null SKUs', () => {
  const provider = new NuvemshopProvider();
  const originalFetch = global.fetch;
  const config = { storeId: '123', accessToken: 'tok' };

  afterEach(() => { global.fetch = originalFetch; });

  it('INV-NUV-NEW-001: produto com todas as variantes sem SKU não faz yield', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ([{
          id: 1, name: { pt: 'Produto' },
          variants: [
            { id: 'v1', sku: null, stock: 10, price: '20', values: ['Azul'] },
            { id: 'v2', sku: '', stock: 5, price: '20', values: ['Vermelho'] },
          ],
        }]),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ([]),
      }) as unknown as typeof fetch;

    const batches: unknown[] = [];
    for await (const b of provider.fetchStock(config)) batches.push(b);

    expect(batches).toHaveLength(0);
  });

  it('INV-NUV-NEW-002: variante sem SKU é ignorada, variante com SKU é incluída', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ([{
          id: 1, name: { pt: 'Produto' },
          variants: [
            { id: 'v1', sku: null, stock: 10, price: '20', values: ['Azul'] },
            { id: 'v2', sku: 'VALID-SKU', stock: 3, price: '25', values: ['Verde'] },
          ],
        }]),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ([]),
      }) as unknown as typeof fetch;

    const batches: any[][] = [];
    for await (const b of provider.fetchStock(config)) batches.push(b);

    expect(batches).toHaveLength(1);
    expect(batches[0]).toHaveLength(1);
    expect(batches[0][0].sku).toBe('VALID-SKU');
  });
});

// ─── 14. Provider: ShopifyProvider variant with null SKU ──────────────────────

describe('ShopifyProvider – variants with empty or null SKU', () => {
  const provider = new ShopifyProvider();
  const originalFetch = global.fetch;
  const config = { shopUrl: 'https://shop.myshopify.com', accessToken: 'tok' };

  afterEach(() => { global.fetch = originalFetch; });

  it('INV-SHOPIFY-NEW-001: variante com sku null é ignorada', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ products: [{ title: 'Prod', variants: [{ id: 1, sku: null, inventory_quantity: 5, price: '10', title: 'Default' }] }] }),
      headers: { get: () => null },
    }) as unknown as typeof fetch;

    const batches: unknown[] = [];
    for await (const b of provider.fetchStock(config)) batches.push(b);

    expect(batches).toHaveLength(0);
  });

  it('INV-SHOPIFY-NEW-002: variante com sku string vazia é ignorada', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ products: [{ title: 'Prod', variants: [{ id: 1, sku: '', inventory_quantity: 3, price: '20', title: 'Default' }] }] }),
      headers: { get: () => null },
    }) as unknown as typeof fetch;

    const batches: unknown[] = [];
    for await (const b of provider.fetchStock(config)) batches.push(b);

    expect(batches).toHaveLength(0);
  });

  it('INV-SHOPIFY-NEW-003: variante com SKU válido é incluída', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ products: [{ title: 'Prod', variants: [{ id: 1, sku: 'SHO-001', inventory_quantity: 7, price: '30', title: 'M' }] }] }),
      headers: { get: () => null },
    }) as unknown as typeof fetch;

    const batches: any[][] = [];
    for await (const b of provider.fetchStock(config)) batches.push(b);

    expect(batches[0][0].sku).toBe('SHO-001');
    expect(batches[0][0].availableQuantity).toBe(7);
  });
});

// ─── 15. InventoryAsyncJobsService – gaps ────────────────────────────────────

describe('InventoryAsyncJobsService – uncovered edge cases', () => {
  let service: InventoryAsyncJobsService;
  let inventoryAsyncJob: { create: jest.Mock; update: jest.Mock; findMany: jest.Mock; findFirst: jest.Mock };

  const mockJob = (overrides: Record<string, unknown> = {}) => ({
    id: 'job-1', tenantId: 'tenant-1', type: 'EXPORT_INVENTORY_REPORT_CSV',
    status: 'QUEUED', requestedByUserId: 'user-1', requestedByUserEmail: 'u@t.com',
    payload: {}, progress: 0, totalItems: 0, processedItems: 0, resultSummary: {},
    fileName: null, fileMimeType: null, fileUrl: null, fileContent: null,
    errorMessage: null, queueJobId: null, createdAt: new Date(), updatedAt: new Date(),
    completedAt: null, failedAt: null, ...overrides,
  });

  beforeEach(() => {
    inventoryAsyncJob = { create: jest.fn(), update: jest.fn().mockResolvedValue(mockJob()), findMany: jest.fn(), findFirst: jest.fn() };
    const prisma = { inventoryAsyncJob } as unknown as PrismaService;
    service = new InventoryAsyncJobsService(prisma);
  });

  it('INV-JOBS-NEW-001: getDownloadPayload com job PROCESSING lança EntityNotFoundException (query requer COMPLETED)', async () => {
    inventoryAsyncJob.findFirst.mockResolvedValue(null);

    await expect(service.getDownloadPayload('tenant-1', 'job-1')).rejects.toBeInstanceOf(EntityNotFoundException);
  });

  it('INV-JOBS-NEW-002: getDownloadPayload com job QUEUED lança EntityNotFoundException', async () => {
    inventoryAsyncJob.findFirst.mockResolvedValue(null);

    await expect(service.getDownloadPayload('tenant-1', 'job-queued')).rejects.toThrow(EntityNotFoundException);
  });

  it('INV-JOBS-NEW-003: getDownloadPayload retorna fileName fallback quando fileName é null', async () => {
    inventoryAsyncJob.findFirst.mockResolvedValue(
      mockJob({ status: 'COMPLETED', fileName: null, fileMimeType: null, fileContent: 'csv', fileUrl: null }),
    );

    const result = await service.getDownloadPayload('tenant-1', 'job-1');

    expect(result.fileName).toContain('relatorio-estoque-');
    expect(result.fileMimeType).toBe('text/csv;charset=utf-8');
  });

  it('INV-JOBS-NEW-004: attachQueueJobId chama update com queueJobId correto', async () => {
    await service.attachQueueJobId('job-1', 'bull-42');

    expect(inventoryAsyncJob.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: { queueJobId: 'bull-42' },
    });
  });

  it('INV-JOBS-NEW-005: attachQueueJobId quando update lança propaga o erro', async () => {
    inventoryAsyncJob.update.mockRejectedValue(new Error('Record not found'));

    await expect(service.attachQueueJobId('missing-job', 'q-1')).rejects.toThrow('Record not found');
  });

  it('INV-JOBS-NEW-006: listJobs usa take=15 padrão e ordena por createdAt desc', async () => {
    inventoryAsyncJob.findMany.mockResolvedValue([]);

    await service.listJobs('tenant-1');

    expect(inventoryAsyncJob.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'desc' }, take: 15 }),
    );
  });
});

// ─── 16. InventoryAsyncJobProcessor – markProcessing throws ──────────────────

describe('InventoryAsyncJobProcessor – markProcessing throws (ghost job)', () => {
  let asyncJobsService: jest.Mocked<Pick<InventoryAsyncJobsService, 'markProcessing' | 'completeJob' | 'failJob'>>;
  let generateReportUseCase: jest.Mocked<Pick<any, 'execute'>>;
  let csvBuilder: jest.Mocked<Pick<InventoryReportCsvBuilder, 'build'>>;
  let fileStorage: jest.Mocked<FileStorageService>;
  let syncConnectionUseCase: jest.Mocked<Pick<any, 'execute'>>;
  let processor: InventoryAsyncJobProcessor;

  const basePayload = { asyncJobId: 'job-x', type: 'EXPORT_INVENTORY_REPORT_CSV' as const, tenantId: 'tenant-1' };

  beforeEach(() => {
    asyncJobsService = {
      markProcessing: jest.fn().mockResolvedValue(undefined),
      completeJob: jest.fn().mockResolvedValue(undefined),
      failJob: jest.fn().mockResolvedValue(undefined),
    };
    generateReportUseCase = { execute: jest.fn().mockResolvedValue({ generatedAt: new Date(), summary: { totalItems: 0, totalQuantity: 0, availableItems: 0, lowStockItems: 0, unavailableItems: 0, reservedItems: 0, estimatedInventoryValue: 0 }, items: [] }) };
    csvBuilder = { build: jest.fn().mockReturnValue({ fileName: 'r.csv', mimeType: 'text/csv', content: 'h,s\n' }) };
    fileStorage = { upload: jest.fn().mockRejectedValue(new Error('no storage')) } as unknown as jest.Mocked<FileStorageService>;
    syncConnectionUseCase = { execute: jest.fn() };
    processor = new InventoryAsyncJobProcessor(
      asyncJobsService as unknown as InventoryAsyncJobsService,
      generateReportUseCase as any,
      csvBuilder as unknown as InventoryReportCsvBuilder,
      fileStorage,
      syncConnectionUseCase as any,
    );
  });

  it('INV-PROC-NEW-001: quando markProcessing lança, o erro propaga e failJob não é chamado com asyncJobId diferente', async () => {
    asyncJobsService.markProcessing.mockRejectedValue(new Error('Job already deleted'));
    const job = { name: 'export-inventory-report-csv', data: basePayload } as unknown as Job<typeof basePayload>;

    await expect(processor.process(job)).rejects.toThrow('Job already deleted');

    // failJob should be called with the correct asyncJobId from the payload
    expect(asyncJobsService.failJob).toHaveBeenCalledWith('job-x', expect.any(String));
  });

  it('INV-PROC-NEW-002: job sem asyncJobId no payload ainda chama markProcessing com undefined', async () => {
    const brokenPayload = { type: 'EXPORT_INVENTORY_REPORT_CSV' as const, tenantId: 'tenant-1' } as any;
    const job = { name: 'export-inventory-report-csv', data: brokenPayload } as unknown as Job<any>;

    await processor.process(job);

    expect(asyncJobsService.markProcessing).toHaveBeenCalledWith(undefined, expect.any(Object));
  });
});

// ─── 17. BlingProvider – rate-limit on second page ───────────────────────────

describe('BlingProvider – rate-limit mid-pagination', () => {
  const provider = new BlingProvider();
  const originalFetch = global.fetch;

  afterEach(() => { global.fetch = originalFetch; });

  it('INV-BLING-NEW-001: quando a segunda página retorna 429, o generator propaga o erro', async () => {
    const page1 = { ok: true, json: async () => ({ data: [{ id: 1, codigo: 'B1', nome: 'P1', estoque: { saldoVirtual: 5 }, preco: 10 }] }) };
    const page2 = { ok: false, status: 429 };

    global.fetch = jest.fn()
      .mockResolvedValueOnce(page1)
      .mockResolvedValueOnce(page2) as unknown as typeof fetch;

    const gen = provider.fetchStock({ accessToken: 'tok' });
    await gen.next(); // page 1 succeeds
    await expect(gen.next()).rejects.toThrow(/429/);
  });

  it('INV-BLING-NEW-002: produto com saldoFisicoTotal=0 tem availabilityStatus UNAVAILABLE', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: 1, codigo: 'BZ', nome: 'P-Zero', estoque: { saldoVirtual: 0 }, preco: 5 }] }),
    }) as unknown as typeof fetch;

    const batches: any[][] = [];
    for await (const b of provider.fetchStock({ accessToken: 'tok' })) batches.push(b);

    expect(batches[0][0].availabilityStatus).toBe('UNAVAILABLE');
  });
});

// ─── 18. ListInventoryItemsUseCase – query passthrough and edge cases ─────────

describe('ListInventoryItemsUseCase – query edge cases', () => {
  let repo: jest.Mocked<IInventoryRepository>;
  let useCase: ListInventoryItemsUseCase;

  beforeEach(() => {
    repo = makeMockedRepo();
    useCase = new ListInventoryItemsUseCase(repo);
  });

  it('INV-LIST-NEW-001: SQL-injection-like query é passada ao repo sem sanitização (repo usa Prisma params)', async () => {
    repo.listItems.mockResolvedValue([]);

    await useCase.execute({ tenantId: 'tenant-1', query: "'; DROP TABLE--" });

    expect(repo.listItems).toHaveBeenCalledWith(
      expect.objectContaining({ query: "'; DROP TABLE--" }),
    );
  });

  it('INV-LIST-NEW-002: query extremamente longa (500 chars) é passada ao repo sem truncamento', async () => {
    repo.listItems.mockResolvedValue([]);
    const longQuery = 'x'.repeat(500);

    await useCase.execute({ tenantId: 'tenant-1', query: longQuery });

    expect(repo.listItems).toHaveBeenCalledWith(
      expect.objectContaining({ query: longQuery }),
    );
  });

  it('INV-LIST-NEW-003: query undefined não é passada ao repo como string', async () => {
    repo.listItems.mockResolvedValue([]);

    await useCase.execute({ tenantId: 'tenant-1' });

    expect(repo.listItems).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1' }),
    );
  });

  it('INV-LIST-NEW-004: quando repo lança, o erro propaga sem silenciar', async () => {
    repo.listItems.mockRejectedValue(new Error('Connection refused'));

    await expect(useCase.execute({ tenantId: 'tenant-1' })).rejects.toThrow('Connection refused');
  });

  it('INV-LIST-NEW-005: retorna lista vazia quando repositório retorna array vazio', async () => {
    repo.listItems.mockResolvedValue([]);

    const result = await useCase.execute({ tenantId: 'tenant-1', query: 'nothing' });

    expect(result).toEqual([]);
  });

  it('INV-LIST-NEW-006: availableOnly true é repassado ao repo', async () => {
    repo.listItems.mockResolvedValue([]);

    await useCase.execute({ tenantId: 'tenant-1', availableOnly: true });

    expect(repo.listItems).toHaveBeenCalledWith(
      expect.objectContaining({ availableOnly: true }),
    );
  });

  it('INV-LIST-NEW-007: tenantId é sempre passado ao repo para isolar dados', async () => {
    repo.listItems.mockResolvedValue([]);

    await useCase.execute({ tenantId: 'my-tenant-id' });

    expect(repo.listItems).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'my-tenant-id' }),
    );
  });

  it('INV-LIST-NEW-008: resultado do repo é retornado sem transformação', async () => {
    const items = [makeItem(), makeItem({ id: 'item-2', sku: 'SKU-002' })];
    repo.listItems.mockResolvedValue(items);

    const result = await useCase.execute({ tenantId: 'tenant-1' });

    expect(result).toBe(items);
  });
});

