import { randomBytes } from 'crypto';
import {
  backfillEncryptCredentials,
  BackfillConnectionStore,
} from '../scripts/backfill-encrypt-credentials';
import { AesGcmCredentialCipher } from '../infrastructure/security/AesGcmCredentialCipher';

describe('backfillEncryptCredentials', () => {
  const ENV_KEY = 'INVENTORY_CONFIG_ENCRYPTION_KEY';
  const originalKey = process.env[ENV_KEY];
  let cipher: AesGcmCredentialCipher;

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
    cipher = new AesGcmCredentialCipher();
  });

  it('INV-BACKFILL-001: criptografa segredos em texto plano', async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    const store: BackfillConnectionStore = {
      findMany: jest.fn().mockResolvedValue([
        { id: 'c1', sourceType: 'BLING', config: { accessToken: 'plain' } },
      ]),
      update,
    };

    const result = await backfillEncryptCredentials(store, cipher);

    expect(result.updated).toBe(1);
    const data = update.mock.calls[0][0].data.config as Record<string, unknown>;
    expect((data.accessToken as string).startsWith('v1:')).toBe(true);
  });

  it('INV-BACKFILL-002: pula linhas já criptografadas (idempotente)', async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    const store: BackfillConnectionStore = {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'c1',
          sourceType: 'BLING',
          config: { accessToken: cipher.encrypt('already') },
        },
      ]),
      update,
    };

    const result = await backfillEncryptCredentials(store, cipher);

    expect(result.scanned).toBe(1);
    expect(result.updated).toBe(0);
    expect(update).not.toHaveBeenCalled();
  });

  it('INV-BACKFILL-003: ignora sourceType sem chaves secretas', async () => {
    const update = jest.fn();
    const store: BackfillConnectionStore = {
      findMany: jest.fn().mockResolvedValue([
        { id: 'c1', sourceType: 'MANUAL_SNAPSHOT', config: { foo: 'bar' } },
      ]),
      update,
    };

    const result = await backfillEncryptCredentials(store, cipher);

    expect(result.updated).toBe(0);
    expect(update).not.toHaveBeenCalled();
  });
});
