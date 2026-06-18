/**
 * Unit tests for PrismaTenantTwilioAccountRepository – T1-B
 *
 * Verifies that authToken is NEVER stored as plaintext and is correctly
 * decrypted when reading back. Uses a jest mock for PrismaService so no
 * database is required.
 */

import { scryptSync } from 'crypto';
import { PrismaTenantTwilioAccountRepository } from '../infrastructure/persistence/repositories/PrismaTenantTwilioAccountRepository';
import { decrypt } from '@shared/crypto/field-encryption';

// ---------------------------------------------------------------------------
// Key shared across all tests
// ---------------------------------------------------------------------------
const TEST_SECRET = 'unit-test-secret-key';
const TEST_KEY = scryptSync(TEST_SECRET, 'atendeai-salt', 32) as Buffer;

// ---------------------------------------------------------------------------
// Mock PrismaService
// ---------------------------------------------------------------------------
const mockExecuteRaw = jest.fn().mockResolvedValue(1);
const mockQueryRaw = jest.fn();

const mockPrisma = {
  $executeRaw: mockExecuteRaw,
  $queryRaw: mockQueryRaw,
} as any;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeTwilioAccount() {
  return {
    tenantId: '00000000-0000-0000-0000-000000000001',
    accountSid: 'AC1234567890abcdef',
    authToken: 'plaintext-auth-token-secret',
    status: 'ACTIVE',
    friendlyName: 'Test Account',
  };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------
describe('PrismaTenantTwilioAccountRepository – T1-B: authToken encryption', () => {
  let repo: PrismaTenantTwilioAccountRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.APP_SECRETS_KEY = TEST_SECRET;
    repo = new PrismaTenantTwilioAccountRepository(mockPrisma);
  });

  afterEach(() => {
    delete process.env.APP_SECRETS_KEY;
  });

  // -------------------------------------------------------------------------
  // upsert – write path
  // -------------------------------------------------------------------------
  describe('upsert() – write path', () => {
    it('stores an encrypted value, NOT the plaintext authToken', async () => {
      const account = makeTwilioAccount();
      await repo.upsert(account);

      expect(mockExecuteRaw).toHaveBeenCalledTimes(1);

      // Extract the SQL template strings + values from the tagged template call
      const [sqlTemplate] = mockExecuteRaw.mock.calls[0];
      // The values array on a Prisma.sql tagged template literal
      const storedValues: unknown[] = sqlTemplate.values ?? [];

      // authToken is the 3rd positional value (index 2: tenantId, accountSid, authToken, ...)
      const storedAuthToken = storedValues[2];

      expect(typeof storedAuthToken).toBe('string');
      // Must NOT be the plaintext value
      expect(storedAuthToken).not.toBe(account.authToken);
      expect(storedAuthToken as string).not.toContain(account.authToken);
      // Must be decryptable back to the original
      expect(decrypt(storedAuthToken as string, TEST_KEY)).toBe(account.authToken);
    });

    it('uses a different IV each call (no deterministic ciphertext)', async () => {
      const account = makeTwilioAccount();
      await repo.upsert(account);
      await repo.upsert(account);

      const [call1] = mockExecuteRaw.mock.calls[0];
      const [call2] = mockExecuteRaw.mock.calls[1];
      const stored1 = (call1.values ?? [])[2];
      const stored2 = (call2.values ?? [])[2];

      expect(stored1).not.toBe(stored2);
    });

    it('throws when APP_SECRETS_KEY is missing', async () => {
      delete process.env.APP_SECRETS_KEY;
      const account = makeTwilioAccount();
      await expect(repo.upsert(account)).rejects.toThrow(
        /APP_SECRETS_KEY environment variable is required/,
      );
    });
  });

  // -------------------------------------------------------------------------
  // findByTenantId – read path
  // -------------------------------------------------------------------------
  describe('findByTenantId() – read path', () => {
    it('returns decrypted authToken to the caller', async () => {
      const account = makeTwilioAccount();

      // Simulate what the DB stores (the encrypted value)
      const { encrypt } = await import('@shared/crypto/field-encryption');
      const encryptedToken = encrypt(account.authToken, TEST_KEY);

      mockQueryRaw.mockResolvedValueOnce([
        {
          tenant_id: account.tenantId,
          account_sid: account.accountSid,
          auth_token: encryptedToken, // DB returns encrypted
          status: account.status,
          friendly_name: account.friendlyName,
        },
      ]);

      const result = await repo.findByTenantId(account.tenantId);

      expect(result).not.toBeNull();
      // Caller receives the PLAINTEXT
      expect(result!.authToken).toBe(account.authToken);
      // And the returned value must NOT be the raw encrypted blob
      expect(result!.authToken).not.toBe(encryptedToken);
    });

    it('returns null when no row is found', async () => {
      mockQueryRaw.mockResolvedValueOnce([]);
      const result = await repo.findByTenantId('non-existent-uuid');
      expect(result).toBeNull();
    });

    it('throws when APP_SECRETS_KEY is missing during read', async () => {
      const { encrypt } = await import('@shared/crypto/field-encryption');
      const encryptedToken = encrypt('some-token', TEST_KEY);

      mockQueryRaw.mockResolvedValueOnce([
        {
          tenant_id: '00000000-0000-0000-0000-000000000001',
          account_sid: 'AC123',
          auth_token: encryptedToken,
          status: 'ACTIVE',
          friendly_name: 'Test',
        },
      ]);

      delete process.env.APP_SECRETS_KEY;

      await expect(
        repo.findByTenantId('00000000-0000-0000-0000-000000000001'),
      ).rejects.toThrow(/APP_SECRETS_KEY environment variable is required/);
    });
  });
});
