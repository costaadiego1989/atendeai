/**
 * Field-level AES-256-GCM encryption for sensitive database columns.
 *
 * All secrets remain inside the infrastructure layer — callers above
 * (domain, application) never receive raw keys or raw ciphertext.
 *
 * Stored format (base64):  <12-byte IV>:<16-byte auth tag>:<ciphertext>
 * Separator character: ':'  (colons cannot appear in base64 alphabet used here
 *                             because we use URL-safe base64 with no padding)
 *
 * Key derivation: scryptSync(APP_SECRETS_KEY, 'atendeai-salt', 32)
 *   — accepts any-length passphrase, always produces 32 bytes for AES-256.
 *   — If APP_SECRETS_KEY is already a 64-char hex string (32 bytes) the scrypt
 *     step is still applied so that the stored-key format is irrelevant to callers.
 */

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'crypto';

const ALGORITHM = 'aes-256-gcm' as const;
const IV_BYTES = 12; // GCM standard IV length
const TAG_BYTES = 16; // GCM auth tag length
const KEY_BYTES = 32; // AES-256
const SALT = 'atendeai-salt';

/**
 * Returns the raw 32-byte encryption key derived from APP_SECRETS_KEY.
 * Throws at runtime if the environment variable is absent or empty.
 */
export function getEncryptionKey(): Buffer {
  const secret = process.env.APP_SECRETS_KEY;
  if (!secret || secret.trim().length === 0) {
    throw new Error(
      'APP_SECRETS_KEY environment variable is required but not set. ' +
        'Set it to a strong random secret before starting the application.',
    );
  }
  return scryptSync(secret, SALT, KEY_BYTES) as Buffer;
}

/**
 * Encrypts a plaintext string with AES-256-GCM.
 *
 * @param plaintext - The value to encrypt (UTF-8).
 * @param key - Optional pre-derived key (Buffer, 32 bytes). Defaults to
 *              `getEncryptionKey()`. Accepting an explicit key makes unit
 *              testing deterministic without touching process.env.
 * @returns Base64url-encoded string: `<iv>:<tag>:<ciphertext>`
 */
export function encrypt(plaintext: string, key?: Buffer): string {
  const derivedKey = key ?? getEncryptionKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, derivedKey, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  // Encode each component individually then join — avoids any ambiguity
  return [
    iv.toString('base64'),
    tag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':');
}

/**
 * Decrypts a value produced by `encrypt`.
 *
 * @param ciphertext - Base64url string in the format `<iv>:<tag>:<ciphertext>`.
 * @param key - Optional pre-derived key (Buffer, 32 bytes).
 * @returns Original plaintext (UTF-8).
 * @throws If the ciphertext is malformed or the auth tag verification fails.
 */
export function decrypt(ciphertext: string, key?: Buffer): string {
  const derivedKey = key ?? getEncryptionKey();
  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error(
      `Invalid encrypted field format: expected 3 colon-separated segments, got ${parts.length}.`,
    );
  }
  const [ivB64, tagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const encrypted = Buffer.from(dataB64, 'base64');

  const decipher = createDecipheriv(ALGORITHM, derivedKey, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

/**
 * Encrypts a JSON-serialisable object. Returns a base64 encrypted string
 * suitable for storage in a text / jsonb column.
 */
export function encryptJson(value: unknown, key?: Buffer): string {
  return encrypt(JSON.stringify(value), key);
}

/**
 * Decrypts and parses a value previously stored with `encryptJson`.
 */
export function decryptJson<T = unknown>(ciphertext: string, key?: Buffer): T {
  return JSON.parse(decrypt(ciphertext, key)) as T;
}
