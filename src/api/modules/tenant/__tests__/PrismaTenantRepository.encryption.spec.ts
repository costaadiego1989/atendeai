/**
 * Unit tests for PrismaTenantRepository – T1-A (WhatsApp credentials) and
 * T1-A-instagram (meta_access_token in instagram_configs).
 *
 * These are pure unit tests — no database required.
 * The tests assert:
 *   1. credentials JSON is NEVER stored as plaintext in the DB column
 *   2. meta_access_token is NEVER stored as plaintext
 *   3. Both values are decryptable back to their originals
 *   4. Reads decrypt the values before returning them to callers
 */

import { scryptSync } from 'crypto';
import { decrypt, encrypt } from '@shared/crypto/field-encryption';

// ---------------------------------------------------------------------------
// Key shared across all tests
// ---------------------------------------------------------------------------
const TEST_SECRET = 'unit-test-whatsapp-secret';
const TEST_KEY = scryptSync(TEST_SECRET, 'atendeai-salt', 32) as Buffer;

// ---------------------------------------------------------------------------
// Mock tx (the transaction proxy passed by $transaction callback)
// ---------------------------------------------------------------------------
let capturedTxExecuteRawCalls: any[][] = [];

const mockTx = {
  tenant: {
    upsert: jest.fn().mockResolvedValue({}),
  },
  user: {
    upsert: jest.fn().mockResolvedValue({}),
  },
  aIConfig: {
    upsert: jest.fn().mockResolvedValue({}),
  },
  $executeRaw: jest.fn().mockImplementation((...args: any[]) => {
    capturedTxExecuteRawCalls.push(args);
    return Promise.resolve(1);
  }),
};

const mockPrisma = {
  $transaction: jest.fn().mockImplementation(async (cb: (tx: any) => any) => {
    return cb(mockTx);
  }),
  $queryRaw: jest.fn(),
  $executeRaw: jest.fn(),
} as any;

// ---------------------------------------------------------------------------
// Lazy import to allow jest.mock resolution before import
// ---------------------------------------------------------------------------
let PrismaTenantRepositoryClass: typeof import('../infrastructure/persistence/repositories/PrismaTenantRepository').PrismaTenantRepository;

beforeAll(async () => {
  const mod = await import(
    '../infrastructure/persistence/repositories/PrismaTenantRepository'
  );
  PrismaTenantRepositoryClass = mod.PrismaTenantRepository;
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeWhatsAppConfig() {
  return {
    id: 'aaaaaaaa-0000-0000-0000-000000000001',
    tenantId: '00000000-0000-0000-0000-000000000001',
    credentials: {
      token: 'plaintext-token-secret',
      accountSid: 'AC_PLAIN',
      authToken: 'auth-secret-value',
    },
    provider: 'TWILIO',
    whatsappNumber: '+5511999999999',
    webhookSecret: 'webhook-secret',
    status: 'ACTIVE',
    configuredAt: new Date('2024-01-01T00:00:00Z'),
  };
}

function makeInstagramConfig() {
  return {
    id: 'bbbbbbbb-0000-0000-0000-000000000002',
    tenantId: '00000000-0000-0000-0000-000000000001',
    metaAccessToken: 'EAABsbCS3ZCAZsomeLongMetaAccessToken',
    instagramAccountId: 'ig_account_123',
    webhookSecret: 'ig-webhook-secret',
    status: 'ACTIVE',
    configuredAt: new Date('2024-01-01T00:00:00Z'),
  };
}

// Minimal tenant persistence shape that TenantMapper.toPersistence would return
function makePersistenceData(options: {
  withWhatsapp?: boolean;
  withInstagram?: boolean;
}) {
  return {
    tenant: {
      id: '00000000-0000-0000-0000-000000000001',
      cnpj: '00.000.000/0001-00',
      companyName: 'Test Co',
      plan: 'BASIC',
      status: 'ACTIVE',
      createdAt: new Date(),
      catalogFiles: [],
      ownerBirthDate: null,
      streetNumber: null,
      ownerUserId: null,
      businessType: null,
      operatingHours: null,
      description: null,
      services: null,
      catalogUrl: null,
    },
    users: [],
    whatsappConfig: options.withWhatsapp ? makeWhatsAppConfig() : undefined,
    instagramConfig: options.withInstagram ? makeInstagramConfig() : undefined,
    aiConfig: undefined,
  };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------
describe('PrismaTenantRepository – T1-A: WhatsApp + Instagram credential encryption', () => {
  let repo: InstanceType<typeof PrismaTenantRepositoryClass>;

  beforeEach(() => {
    jest.clearAllMocks();
    capturedTxExecuteRawCalls = [];
    process.env.APP_SECRETS_KEY = TEST_SECRET;
    repo = new PrismaTenantRepositoryClass(mockPrisma);
  });

  afterEach(() => {
    delete process.env.APP_SECRETS_KEY;
  });

  // -------------------------------------------------------------------------
  // WhatsApp credentials – write path
  // -------------------------------------------------------------------------
  describe('save() with whatsappConfig – write path', () => {
    it('stores credentials as encrypted value, NOT the plaintext JSON', async () => {
      // We need to bypass TenantMapper — instead we test the repository's
      // internal SQL generation by stubbing $transaction and checking
      // what $executeRaw was called with on the tx.

      // Directly invoke the private save path by calling save() with a
      // mock Tenant whose toPersistence output we control via TenantMapper mock.
      // Since TenantMapper.toPersistence is a static method, we mock it.
      const TenantMapper = await import(
        '../infrastructure/persistence/mappers/TenantMapper'
      );
      jest.spyOn(TenantMapper.TenantMapper, 'toPersistence').mockReturnValue(
        makePersistenceData({ withWhatsapp: true }) as any,
      );

      await repo.save({} as any);

      // Find the $executeRaw call for whatsapp_configs
      const whatsappCall = capturedTxExecuteRawCalls.find((args) => {
        const sql = args[0];
        const str = sql?.strings?.join('') ?? '';
        return str.includes('whatsapp_configs');
      });

      expect(whatsappCall).toBeDefined();
      const sqlTemplate = whatsappCall![0];
      const values: unknown[] = sqlTemplate.values ?? [];

      // The credentials value is at index 4 (id, tenantId, token, provider, credentials, ...)
      const storedCredentials = values[4];
      const plainCredentials = makeWhatsAppConfig().credentials;

      expect(typeof storedCredentials).toBe('string');
      // Must NOT contain any plaintext secret
      expect(storedCredentials as string).not.toContain(plainCredentials.authToken);
      expect(storedCredentials as string).not.toContain(plainCredentials.token);
      expect(storedCredentials as string).not.toContain(plainCredentials.accountSid);
      // Must NOT be raw JSON
      expect(storedCredentials as string).not.toBe(
        JSON.stringify(plainCredentials),
      );
      // Must be decryptable
      const decrypted = JSON.parse(decrypt(storedCredentials as string, TEST_KEY));
      expect(decrypted).toEqual(plainCredentials);
    });

    it('throws when APP_SECRETS_KEY is missing', async () => {
      const TenantMapper = await import(
        '../infrastructure/persistence/mappers/TenantMapper'
      );
      jest.spyOn(TenantMapper.TenantMapper, 'toPersistence').mockReturnValue(
        makePersistenceData({ withWhatsapp: true }) as any,
      );
      delete process.env.APP_SECRETS_KEY;

      await expect(repo.save({} as any)).rejects.toThrow(
        /APP_SECRETS_KEY environment variable is required/,
      );
    });
  });

  // -------------------------------------------------------------------------
  // Instagram meta_access_token – write path
  // -------------------------------------------------------------------------
  describe('save() with instagramConfig – write path', () => {
    it('stores meta_access_token encrypted, NOT the plaintext token', async () => {
      const TenantMapper = await import(
        '../infrastructure/persistence/mappers/TenantMapper'
      );
      jest.spyOn(TenantMapper.TenantMapper, 'toPersistence').mockReturnValue(
        makePersistenceData({ withInstagram: true }) as any,
      );

      await repo.save({} as any);

      const instagramCall = capturedTxExecuteRawCalls.find((args) => {
        const sql = args[0];
        const str = sql?.strings?.join('') ?? '';
        return str.includes('instagram_configs');
      });

      expect(instagramCall).toBeDefined();
      const sqlTemplate = instagramCall![0];
      const values: unknown[] = sqlTemplate.values ?? [];

      // meta_access_token is at index 2 (id, tenantId, meta_access_token, ...)
      const storedToken = values[2];
      const plainToken = makeInstagramConfig().metaAccessToken;

      expect(typeof storedToken).toBe('string');
      expect(storedToken as string).not.toBe(plainToken);
      expect(storedToken as string).not.toContain(plainToken);
      expect(decrypt(storedToken as string, TEST_KEY)).toBe(plainToken);
    });
  });

  // -------------------------------------------------------------------------
  // WhatsApp credentials – read path
  // -------------------------------------------------------------------------
  describe('findWhatsAppConfig read path – decrypts credentials', () => {
    it('returns decrypted credentials when reading whatsapp config', async () => {
      const plainCredentials = makeWhatsAppConfig().credentials;
      const encryptedCreds = encrypt(
        JSON.stringify(plainCredentials),
        TEST_KEY,
      );

      // The private findWhatsAppConfigByTenantId is exercised through findById
      mockPrisma.$queryRaw.mockImplementation((sql: any) => {
        const str = sql?.strings?.join('') ?? '';
        if (str.includes('whatsapp_configs')) {
          return Promise.resolve([
            {
              id: 'aaaaaaaa-0000-0000-0000-000000000001',
              tenant_id: '00000000-0000-0000-0000-000000000001',
              provider: 'TWILIO',
              credentials: encryptedCreds, // DB returns encrypted string
              whatsapp_number: '+5511999999999',
              webhook_secret: null,
              status: 'ACTIVE',
              configured_at: new Date(),
            },
          ]);
        }
        // Return empty for other queries (tenant findUnique via prisma ORM, users, etc.)
        return Promise.resolve([]);
      });

      // Also stub prisma.tenant.findUnique (ORM call in findById)
      mockPrisma.tenant = {
        findUnique: jest.fn().mockResolvedValue(null),
      };

      // findById returns null if tenant is not found — that's fine for this test
      // We just need to verify no error is thrown decrypting, and that credentials
      // are decrypted in the private method. We verify by calling findInstagramConfig
      // and whatsapp config via the exposed aggregated findById or directly test
      // the private method by checking the aggregate path doesn't fail on decrypt.
      // Since findById returns null when tenant ORM call returns null, we verify
      // that the decryption logic path is correct by testing the private helper
      // indirectly through findByBubbleWhatsId which also reads credentials.

      // Direct unit test approach: verify the result from findWhatsAppConfigByTenantId
      // by accessing it through prototype (TypeScript private is a compile-time only check)
      const result = await (repo as any).findWhatsAppConfigByTenantId(
        '00000000-0000-0000-0000-000000000001',
      );

      expect(result).not.toBeNull();
      expect(result.credentials).toEqual(plainCredentials);
      expect(result.credentials.authToken).toBe(plainCredentials.authToken);
    });
  });

  // -------------------------------------------------------------------------
  // Instagram meta_access_token – read path
  // -------------------------------------------------------------------------
  describe('findInstagramConfig read path – decrypts meta_access_token', () => {
    it('returns decrypted metaAccessToken when reading instagram config', async () => {
      const plainToken = 'EAABsbCS3ZCAZsomeLongMetaAccessToken';
      const encryptedToken = encrypt(plainToken, TEST_KEY);

      mockPrisma.$queryRaw.mockImplementation((sql: any) => {
        const str = sql?.strings?.join('') ?? '';
        if (str.includes('instagram_configs')) {
          return Promise.resolve([
            {
              id: 'bbbbbbbb-0000-0000-0000-000000000002',
              tenant_id: '00000000-0000-0000-0000-000000000001',
              meta_access_token: encryptedToken, // DB returns encrypted
              instagram_account_id: 'ig_account_123',
              webhook_secret: 'ig-webhook-secret',
              status: 'ACTIVE',
              configured_at: new Date(),
            },
          ]);
        }
        return Promise.resolve([]);
      });

      const result = await (repo as any).findInstagramConfigByTenantId(
        '00000000-0000-0000-0000-000000000001',
      );

      expect(result).not.toBeNull();
      expect(result.metaAccessToken).toBe(plainToken);
      expect(result.metaAccessToken).not.toBe(encryptedToken);
    });
  });
});
