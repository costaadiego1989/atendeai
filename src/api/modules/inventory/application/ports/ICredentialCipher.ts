export const INVENTORY_CREDENTIAL_CIPHER = 'INVENTORY_CREDENTIAL_CIPHER';

export interface ICredentialCipher {
  encrypt(plaintext: string): string;
  decrypt(ciphertext: string): string;
}
