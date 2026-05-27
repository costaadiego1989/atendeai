import { randomBytes } from 'crypto';
import { AesGcmCredentialCipher } from '../infrastructure/security/AesGcmCredentialCipher';

describe('AesGcmCredentialCipher', () => {
  const ENV_KEY = 'INVENTORY_CONFIG_ENCRYPTION_KEY';
  const originalKey = process.env[ENV_KEY];

  afterAll(() => {
    if (originalKey === undefined) {
      delete process.env[ENV_KEY];
    } else {
      process.env[ENV_KEY] = originalKey;
    }
  });

  describe('construction', () => {
    it('INV-CIPHER-001: lança quando a chave está ausente', () => {
      delete process.env[ENV_KEY];
      expect(() => new AesGcmCredentialCipher()).toThrow(/required/);
    });

    it('INV-CIPHER-002: lança quando a chave não tem 32 bytes', () => {
      process.env[ENV_KEY] = 'short-key';
      expect(() => new AesGcmCredentialCipher()).toThrow(/32-byte/);
    });

    it('INV-CIPHER-003: aceita chave hex e base64 de 32 bytes', () => {
      process.env[ENV_KEY] = randomBytes(32).toString('hex');
      expect(() => new AesGcmCredentialCipher()).not.toThrow();

      process.env[ENV_KEY] = randomBytes(32).toString('base64');
      expect(() => new AesGcmCredentialCipher()).not.toThrow();
    });
  });

  describe('encrypt/decrypt', () => {
    let cipher: AesGcmCredentialCipher;

    beforeEach(() => {
      process.env[ENV_KEY] = randomBytes(32).toString('hex');
      cipher = new AesGcmCredentialCipher();
    });

    it('INV-CIPHER-004: round-trip preserva o texto e usa prefixo v1', () => {
      const encrypted = cipher.encrypt('super-secret-token');
      expect(encrypted.startsWith('v1:')).toBe(true);
      expect(encrypted).not.toContain('super-secret-token');
      expect(cipher.decrypt(encrypted)).toBe('super-secret-token');
    });

    it('INV-CIPHER-005: IV aleatório produz ciphertext distinto por chamada', () => {
      const a = cipher.encrypt('value');
      const b = cipher.encrypt('value');
      expect(a).not.toBe(b);
      expect(cipher.decrypt(a)).toBe('value');
      expect(cipher.decrypt(b)).toBe('value');
    });

    it('INV-CIPHER-006: texto sem prefixo v1 é retornado como plaintext (compat)', () => {
      expect(cipher.decrypt('legacy-plaintext')).toBe('legacy-plaintext');
    });

    it('INV-CIPHER-007: adulteração do authTag faz a descriptografia falhar', () => {
      const encrypted = cipher.encrypt('value');
      const raw = Buffer.from(encrypted.slice('v1:'.length), 'base64');
      raw[13] = raw[13] ^ 0xff;
      const tampered = `v1:${raw.toString('base64')}`;

      expect(() => cipher.decrypt(tampered)).toThrow();
    });
  });
});
