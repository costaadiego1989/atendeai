import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { ICredentialCipher } from '../../application/ports/ICredentialCipher';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const VERSION_PREFIX = 'v1:';
const ENV_KEY = 'INVENTORY_CONFIG_ENCRYPTION_KEY';

@Injectable()
export class AesGcmCredentialCipher implements ICredentialCipher {
  private readonly key: Buffer;

  constructor() {
    this.key = this.loadKey();
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    const payload = Buffer.concat([iv, authTag, encrypted]);

    return `${VERSION_PREFIX}${payload.toString('base64')}`;
  }

  decrypt(ciphertext: string): string {
    if (!ciphertext.startsWith(VERSION_PREFIX)) {
      return ciphertext;
    }

    const payload = Buffer.from(
      ciphertext.slice(VERSION_PREFIX.length),
      'base64',
    );

    if (payload.length < IV_LENGTH + AUTH_TAG_LENGTH) {
      throw new Error('Invalid ciphertext payload');
    }

    const iv = payload.subarray(0, IV_LENGTH);
    const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = payload.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }

  private loadKey(): Buffer {
    const raw = process.env[ENV_KEY];

    if (!raw || raw.trim().length === 0) {
      throw new Error(
        `${ENV_KEY} is required to encrypt inventory provider credentials`,
      );
    }

    const candidate = raw.trim();
    const fromHex = this.tryDecode(candidate, 'hex');
    if (fromHex) {
      return fromHex;
    }

    const fromBase64 = this.tryDecode(candidate, 'base64');
    if (fromBase64) {
      return fromBase64;
    }

    throw new Error(
      `${ENV_KEY} must be a 32-byte key encoded as hex or base64`,
    );
  }

  private tryDecode(value: string, encoding: 'hex' | 'base64'): Buffer | null {
    try {
      const buffer = Buffer.from(value, encoding);
      if (buffer.length !== KEY_LENGTH) {
        return null;
      }
      if (encoding === 'hex' && !/^[0-9a-fA-F]{64}$/.test(value)) {
        return null;
      }
      return buffer;
    } catch {
      return null;
    }
  }
}
