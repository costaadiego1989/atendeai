import { PrismaInventoryRepository } from '../infrastructure/persistence/repositories/PrismaInventoryRepository';
import { AesGcmCredentialCipher } from '../infrastructure/security/AesGcmCredentialCipher';
import { InventoryCredentialDecryptionError } from '../domain/errors/InventoryCredentialDecryptionError';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { randomBytes } from 'crypto';

describe('PrismaInventoryRepository', () => {
  const ENV_KEY = 'INVENTORY_CONFIG_ENCRYPTION_KEY';
  const originalKey = process.env[ENV_KEY];

  let prisma: {
    inventoryConnection: {
      create: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      updateMany: jest.Mock;
    };
  };
  let cipher: AesGcmCredentialCipher;
  let repository: PrismaInventoryRepository;

  beforeAll(() => {
    process.env[ENV_KEY] = randomBytes(32).toString('hex');
  });

  afterAll(() => {
    if (originalKey === undefined) {
      delete process.env[ENV_KEY];
    } else {
      process.env[ENV_KEY] = originalKey;
    }
  });

  beforeEach(() => {
    prisma = {
      inventoryConnection: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    cipher = new AesGcmCredentialCipher();
    repository = new PrismaInventoryRepository(
      prisma as unknown as PrismaService,
      cipher,
    );
  });

  const dbRow = (config: Record<string, unknown>) => ({
    id: 'conn-1',
    tenantId: 'tenant-1',
    sourceType: 'BLING',
    providerName: 'Bling',
    status: 'ACTIVE',
    config,
    lastSyncedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  describe('getConnection', () => {
    it('INV-REPO-001: filtra por id e tenantId', async () => {
      prisma.inventoryConnection.findFirst.mockResolvedValue(dbRow({}));

      await repository.getConnection('tenant-1', 'conn-1');

      expect(prisma.inventoryConnection.findFirst).toHaveBeenCalledWith({
        where: { id: 'conn-1', tenantId: 'tenant-1' },
      });
    });

    it('INV-REPO-002: retorna null quando id pertence a outro tenant', async () => {
      prisma.inventoryConnection.findFirst.mockResolvedValue(null);

      const result = await repository.getConnection('tenant-1', 'conn-other');

      expect(result).toBeNull();
    });
  });

  describe('markConnectionSyncedAt', () => {
    it('INV-REPO-003: escopo WHERE inclui tenantId', async () => {
      prisma.inventoryConnection.updateMany.mockResolvedValue({ count: 1 });
      const when = new Date();

      await repository.markConnectionSyncedAt('tenant-1', 'conn-1', when);

      expect(prisma.inventoryConnection.updateMany).toHaveBeenCalledWith({
        where: { id: 'conn-1', tenantId: 'tenant-1' },
        data: { lastSyncedAt: when },
      });
    });
  });

  describe('createConnection', () => {
    it('INV-REPO-004: persiste status e criptografa chaves secretas', async () => {
      prisma.inventoryConnection.create.mockImplementation(({ data }) =>
        Promise.resolve(dbRow(data.config as Record<string, unknown>)),
      );

      await repository.createConnection({
        tenantId: 'tenant-1',
        sourceType: 'BLING',
        providerName: 'Bling',
        status: 'FAILED',
        config: { accessToken: 'secret-token', summary: 'Loja' },
      });

      const created = prisma.inventoryConnection.create.mock.calls[0][0];
      expect(created.data.status).toBe('FAILED');
      expect(created.data.config.accessToken).toMatch(/^v1:/);
      expect(created.data.config.summary).toBe('Loja');
    });
  });

  describe('mapConnection encryption', () => {
    it('INV-REPO-005: descriptografa chaves secretas e exclui segredos do configSummary', async () => {
      const encrypted = cipher.encrypt('plain-token');
      prisma.inventoryConnection.findFirst.mockResolvedValue(
        dbRow({ accessToken: encrypted, summary: 'Loja XYZ' }),
      );

      const result = await repository.getConnection('tenant-1', 'conn-1');

      expect(result?.config.accessToken).toBe('plain-token');
      expect(result?.configSummary).toBe('Loja XYZ');
    });

    it('INV-REPO-006: chaves não secretas permanecem intactas', async () => {
      prisma.inventoryConnection.findFirst.mockResolvedValue(
        dbRow({ accessToken: cipher.encrypt('tok'), shopUrl: 'plain-url' }),
      );

      const result = await repository.getConnection('tenant-1', 'conn-1');

      expect(result?.config.shopUrl).toBe('plain-url');
    });

    it('INV-REPO-007: falha de descriptografia lança InventoryCredentialDecryptionError', async () => {
      prisma.inventoryConnection.findFirst.mockResolvedValue(
        dbRow({ accessToken: 'v1:dGFtcGVyZWQ=' }),
      );

      await expect(
        repository.getConnection('tenant-1', 'conn-1'),
      ).rejects.toBeInstanceOf(InventoryCredentialDecryptionError);
    });
  });
});
