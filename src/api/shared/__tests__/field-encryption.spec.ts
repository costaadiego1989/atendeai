/**
 * TDD tests for shared/crypto/field-encryption.ts
 *
 * These tests are pure unit tests — no database, no NestJS bootstrap.
 * They use the Node.js built-in crypto module only.
 */

import { randomBytes, scryptSync } from 'crypto';
import {
  encrypt,
  decrypt,
  encryptJson,
  decryptJson,
  getEncryptionKey,
} from '../crypto/field-encryption';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Derive a deterministic test key without touching process.env */
const TEST_KEY = scryptSync('test-secret-passphrase', 'atendeai-salt', 32) as Buffer;

// ---------------------------------------------------------------------------
// getEncryptionKey
// ---------------------------------------------------------------------------

describe('getEncryptionKey()', () => {
  const ORIGINAL = process.env.APP_SECRETS_KEY;

  afterEach(() => {
    // Restore env after each test that modifies it
    if (ORIGINAL === undefined) {
      delete process.env.APP_SECRETS_KEY;
    } else {
      process.env.APP_SECRETS_KEY = ORIGINAL;
    }
  });

  it('throws when APP_SECRETS_KEY is not set', () => {
    delete process.env.APP_SECRETS_KEY;
    expect(() => getEncryptionKey()).toThrow(
      /APP_SECRETS_KEY environment variable is required/,
    );
  });

  it('throws when APP_SECRETS_KEY is an empty string', () => {
    process.env.APP_SECRETS_KEY = '';
    expect(() => getEncryptionKey()).toThrow(
      /APP_SECRETS_KEY environment variable is required/,
    );
  });

  it('throws when APP_SECRETS_KEY is whitespace only', () => {
    process.env.APP_SECRETS_KEY = '   ';
    expect(() => getEncryptionKey()).toThrow(
      /APP_SECRETS_KEY environment variable is required/,
    );
  });

  it('returns a 32-byte Buffer when key is set', () => {
    process.env.APP_SECRETS_KEY = 'a-valid-test-secret';
    const key = getEncryptionKey();
    expect(Buffer.isBuffer(key)).toBe(true);
    expect(key.length).toBe(32);
  });

  it('returns the same derived key for the same passphrase', () => {
    process.env.APP_SECRETS_KEY = 'reproducible-key';
    const k1 = getEncryptionKey();
    const k2 = getEncryptionKey();
    expect(k1.equals(k2)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// encrypt / decrypt – roundtrip
// ---------------------------------------------------------------------------

describe('encrypt() / decrypt() roundtrip', () => {
  it('roundtrips a simple string', () => {
    const plaintext = 'hello world';
    const ct = encrypt(plaintext, TEST_KEY);
    expect(decrypt(ct, TEST_KEY)).toBe(plaintext);
  });

  it('roundtrips an empty string', () => {
    const ct = encrypt('', TEST_KEY);
    expect(decrypt(ct, TEST_KEY)).toBe('');
  });

  it('roundtrips a string with special characters', () => {
    const plaintext = 'token:with:colons & "quotes" \n newlines';
    const ct = encrypt(plaintext, TEST_KEY);
    expect(decrypt(ct, TEST_KEY)).toBe(plaintext);
  });

  it('roundtrips a long string (> 1 KB)', () => {
    const plaintext = randomBytes(1024).toString('hex');
    const ct = encrypt(plaintext, TEST_KEY);
    expect(decrypt(ct, TEST_KEY)).toBe(plaintext);
  });

  it('roundtrips a Twilio-like authToken', () => {
    const authToken = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4';
    const ct = encrypt(authToken, TEST_KEY);
    expect(decrypt(ct, TEST_KEY)).toBe(authToken);
  });

  it('roundtrips a bearer token (OAuth access_token)', () => {
    const token = 'EAABsbCS3ZCAZ...longInstagramAccessToken==';
    const ct = encrypt(token, TEST_KEY);
    expect(decrypt(ct, TEST_KEY)).toBe(token);
  });
});

// ---------------------------------------------------------------------------
// encrypt – output format and randomness
// ---------------------------------------------------------------------------

describe('encrypt() output properties', () => {
  it('produces output with exactly 3 colon-separated segments (iv:tag:ciphertext)', () => {
    const ct = encrypt('secret', TEST_KEY);
    const parts = ct.split(':');
    expect(parts).toHaveLength(3);
  });

  it('produces different IVs on each call (probabilistic — fails only ~1 in 2^96)', () => {
    const ct1 = encrypt('same plaintext', TEST_KEY);
    const ct2 = encrypt('same plaintext', TEST_KEY);
    // Same plaintext, same key → different ciphertext because IV is random
    expect(ct1).not.toBe(ct2);
  });

  it('produces different ciphertext for the same plaintext on each call', () => {
    const results = new Set(
      Array.from({ length: 10 }, () => encrypt('same', TEST_KEY)),
    );
    // All 10 encryptions should be unique (random IV guarantees this)
    expect(results.size).toBe(10);
  });

  it('stored value is NOT the plaintext', () => {
    const plaintext = 'my-secret-token';
    const ct = encrypt(plaintext, TEST_KEY);
    expect(ct).not.toContain(plaintext);
  });

  it('stored value is NOT the plaintext for a Twilio authToken', () => {
    const authToken = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4';
    const ct = encrypt(authToken, TEST_KEY);
    expect(ct).not.toContain(authToken);
  });

  it('stored value is NOT the plaintext for an OAuth access_token', () => {
    const accessToken = 'EAABsbCS3ZCAZsomeLongToken';
    const ct = encrypt(accessToken, TEST_KEY);
    expect(ct).not.toContain(accessToken);
  });
});

// ---------------------------------------------------------------------------
// decrypt – error handling
// ---------------------------------------------------------------------------

describe('decrypt() error handling', () => {
  it('throws on malformed ciphertext (wrong number of segments)', () => {
    expect(() => decrypt('notvalid', TEST_KEY)).toThrow(
      /Invalid encrypted field format/,
    );
    expect(() => decrypt('only:two', TEST_KEY)).toThrow(
      /Invalid encrypted field format/,
    );
    expect(() => decrypt('a:b:c:d', TEST_KEY)).toThrow(
      /Invalid encrypted field format/,
    );
  });

  it('throws when auth tag is tampered (GCM integrity check)', () => {
    const ct = encrypt('sensitive', TEST_KEY);
    // Flip the last character of the ciphertext part
    const parts = ct.split(':');
    const lastChar = parts[2].slice(-1);
    const flipped = lastChar === 'A' ? 'B' : 'A';
    const tampered = parts[0] + ':' + parts[1] + ':' + parts[2].slice(0, -1) + flipped;
    expect(() => decrypt(tampered, TEST_KEY)).toThrow();
  });

  it('throws when decrypting with a wrong key', () => {
    const otherKey = scryptSync('different-passphrase', 'atendeai-salt', 32) as Buffer;
    const ct = encrypt('sensitive', TEST_KEY);
    expect(() => decrypt(ct, otherKey)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// encryptJson / decryptJson
// ---------------------------------------------------------------------------

describe('encryptJson() / decryptJson() roundtrip', () => {
  it('roundtrips a WhatsApp credentials object', () => {
    const credentials = {
      accountSid: 'AC123',
      authToken: 'tok_secret',
      phoneNumberId: '555',
      wabaId: 'waba999',
    };
    const ct = encryptJson(credentials, TEST_KEY);
    const decoded = decryptJson<typeof credentials>(ct, TEST_KEY);
    expect(decoded).toEqual(credentials);
  });

  it('stored value does NOT contain any plaintext secret field', () => {
    const credentials = {
      authToken: 'super-secret-token',
      accountSid: 'ACXXXX',
    };
    const ct = encryptJson(credentials, TEST_KEY);
    expect(ct).not.toContain('super-secret-token');
    expect(ct).not.toContain('ACXXXX');
  });

  it('roundtrips null values inside an object', () => {
    const obj = { token: null, id: 'abc' };
    expect(decryptJson(encryptJson(obj, TEST_KEY), TEST_KEY)).toEqual(obj);
  });
});
