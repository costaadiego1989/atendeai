/**
 * Unit tests for PrismaSocialRepository – T1-C
 *
 * Verifies that access_token and refresh_token are NEVER stored as plaintext
 * and are correctly decrypted when reading back (mapAccount).
 */

import { scryptSync } from 'crypto';
import { PrismaSocialRepository } from '../infrastructure/persistence/PrismaSocialRepository';
import { decrypt, encrypt } from '@shared/crypto/field-encryption';
import { SocialAccount } from '../domain/entities/SocialAccount';
import { UniqueEntityID } from '../../../shared/domain/UniqueEntityID';

// ---------------------------------------------------------------------------
// Key shared across all tests
// ---------------------------------------------------------------------------
const TEST_SECRET = 'unit-test-social-secret';
const TEST_KEY = scryptSync(TEST_SECRET, 'atendeai-salt', 32) as Buffer;

// ---------------------------------------------------------------------------
// Mock PrismaService
// ---------------------------------------------------------------------------
const mockExecuteRawUnsafe = jest.fn().mockResolvedValue(1);
const mockQueryRawUnsafe = jest.fn();

const mockPrisma = {
  $executeRawUnsafe: mockExecuteRawUnsafe,
  $queryRawUnsafe: mockQueryRawUnsafe,
} as any;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeSocialAccount(): SocialAccount {
  return SocialAccount.reconstitute(
    {
      tenantId: '00000000-0000-0000-0000-000000000001',
      platform: 'INSTAGRAM',
      externalAccountId: 'ext_account_123',
      username: 'testuser',
      displayName: 'Test User',
      profilePictureUrl: null,
      accessToken: 'EAABsbCS3ZCAZsomeLongAccessToken',
      refreshToken: 'refresh_secret_token_value',
      tokenExpiresAt: new Date('2025-12-31T00:00:00Z'),
      pageId: 'page_456',
      webhookSecret: 'wh_secret',
      status: 'ACTIVE',
      connectedAt: new Date('2024-01-01T00:00:00Z'),
    },
    new UniqueEntityID('aaaaaaaa-0000-0000-0000-000000000001'),
  );
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------
describe('PrismaSocialRepository – T1-C: access_token + refresh_token encryption', () => {
  let repo: PrismaSocialRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.APP_SECRETS_KEY = TEST_SECRET;
    repo = new PrismaSocialRepository(mockPrisma);
  });

  afterEach(() => {
    delete process.env.APP_SECRETS_KEY;
  });

  // -------------------------------------------------------------------------
  // saveAccount – write path
  // -------------------------------------------------------------------------
  describe('saveAccount() – write path', () => {
    it('stores access_token encrypted, NOT plaintext', async () => {
      const account = makeSocialAccount();
      await repo.saveAccount(account);

      expect(mockExecuteRawUnsafe).toHaveBeenCalledTimes(1);

      const callArgs: unknown[] = mockExecuteRawUnsafe.mock.calls[0];
      // Positional args: [sql, $1=id, $2=tenant_id, $3=platform, $4=ext_id,
      //  $5=username, $6=display_name, $7=profile_picture_url,
      //  $8=access_token, $9=refresh_token, $10=token_expires_at, ...]
      const storedAccessToken = callArgs[8] as string;

      expect(typeof storedAccessToken).toBe('string');
      expect(storedAccessToken).not.toBe(account.accessToken);
      expect(storedAccessToken).not.toContain(account.accessToken!);
      expect(decrypt(storedAccessToken, TEST_KEY)).toBe(account.accessToken);
    });

    it('stores refresh_token encrypted, NOT plaintext', async () => {
      const account = makeSocialAccount();
      await repo.saveAccount(account);

      const callArgs: unknown[] = mockExecuteRawUnsafe.mock.calls[0];
      const storedRefreshToken = callArgs[9] as string | null;

      if (account.refreshToken) {
        expect(typeof storedRefreshToken).toBe('string');
        expect(storedRefreshToken).not.toBe(account.refreshToken);
        expect(storedRefreshToken as string).not.toContain(account.refreshToken);
        expect(decrypt(storedRefreshToken as string, TEST_KEY)).toBe(
          account.refreshToken,
        );
      } else {
        expect(storedRefreshToken).toBeNull();
      }
    });

    it('stores different ciphertexts each call for the same tokens', async () => {
      const account = makeSocialAccount();
      await repo.saveAccount(account);
      await repo.saveAccount(account);

      const stored1 = mockExecuteRawUnsafe.mock.calls[0][8] as string;
      const stored2 = mockExecuteRawUnsafe.mock.calls[1][8] as string;
      // Random IV ensures different ciphertexts
      expect(stored1).not.toBe(stored2);
    });

    it('throws when APP_SECRETS_KEY is missing', async () => {
      delete process.env.APP_SECRETS_KEY;
      const account = makeSocialAccount();
      await expect(repo.saveAccount(account)).rejects.toThrow(
        /APP_SECRETS_KEY environment variable is required/,
      );
    });
  });

  // -------------------------------------------------------------------------
  // findAccountById – read path (mapAccount decrypts)
  // -------------------------------------------------------------------------
  describe('findAccountById() – read path', () => {
    it('returns decrypted access_token to the caller', async () => {
      const account = makeSocialAccount();
      const encryptedAccessToken = encrypt(account.accessToken!, TEST_KEY);
      const encryptedRefreshToken = account.refreshToken
        ? encrypt(account.refreshToken, TEST_KEY)
        : null;

      mockQueryRawUnsafe.mockResolvedValueOnce([
        {
          id: account.id.toValue(),
          tenant_id: account.tenantId,
          platform: account.platform,
          external_account_id: account.externalAccountId,
          username: account.username,
          display_name: account.displayName,
          profile_picture_url: null,
          access_token: encryptedAccessToken, // encrypted in DB
          refresh_token: encryptedRefreshToken, // encrypted in DB
          token_expires_at: account.tokenExpiresAt,
          page_id: account.pageId,
          webhook_secret: account.webhookSecret,
          status: account.status,
          connected_at: account.connectedAt,
        },
      ]);

      const result = await repo.findAccountById(
        account.tenantId,
        account.id.toValue(),
      );

      expect(result).not.toBeNull();
      // Caller sees PLAINTEXT
      expect(result!.accessToken).toBe(account.accessToken);
      expect(result!.refreshToken).toBe(account.refreshToken);
      // NOT the raw encrypted string
      expect(result!.accessToken).not.toBe(encryptedAccessToken);
    });

    it('returns decrypted refresh_token to the caller', async () => {
      const account = makeSocialAccount();
      const encryptedRefreshToken = encrypt(account.refreshToken!, TEST_KEY);

      mockQueryRawUnsafe.mockResolvedValueOnce([
        {
          id: account.id.toValue(),
          tenant_id: account.tenantId,
          platform: account.platform,
          external_account_id: account.externalAccountId,
          username: account.username,
          display_name: account.displayName,
          profile_picture_url: null,
          access_token: encrypt(account.accessToken!, TEST_KEY),
          refresh_token: encryptedRefreshToken,
          token_expires_at: null,
          page_id: null,
          webhook_secret: null,
          status: 'ACTIVE',
          connected_at: account.connectedAt,
        },
      ]);

      const result = await repo.findAccountById(
        account.tenantId,
        account.id.toValue(),
      );

      expect(result!.refreshToken).toBe(account.refreshToken);
      expect(result!.refreshToken).not.toBe(encryptedRefreshToken);
    });

    it('returns null when no account found', async () => {
      mockQueryRawUnsafe.mockResolvedValueOnce([]);
      const result = await repo.findAccountById('tid', 'non-existent');
      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // updateAccountToken – write path
  // -------------------------------------------------------------------------
  describe('updateAccountToken() – write path', () => {
    it('encrypts the updated access_token before storing', async () => {
      const newToken = 'NEW_ACCESS_TOKEN_VALUE';
      const expiresAt = new Date('2026-01-01T00:00:00Z');

      await repo.updateAccountToken(
        '00000000-0000-0000-0000-000000000001',
        'aaaaaaaa-0000-0000-0000-000000000001',
        newToken,
        expiresAt,
      );

      expect(mockExecuteRawUnsafe).toHaveBeenCalledTimes(1);
      const storedToken = mockExecuteRawUnsafe.mock.calls[0][1] as string;

      expect(typeof storedToken).toBe('string');
      expect(storedToken).not.toBe(newToken);
      expect(storedToken).not.toContain(newToken);
      expect(decrypt(storedToken, TEST_KEY)).toBe(newToken);
    });
  });
});
