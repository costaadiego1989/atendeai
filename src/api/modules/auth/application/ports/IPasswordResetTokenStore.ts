export interface PasswordResetTokenRecord {
  id: string;
  userId: string;
  email: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt?: Date;
  createdAt: Date;
}

export interface IPasswordResetTokenStore {
  create(input: {
    userId: string;
    email: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void>;
  findValidByHash(tokenHash: string): Promise<PasswordResetTokenRecord | null>;
  markUsed(id: string): Promise<void>;
  invalidateForUser(userId: string): Promise<void>;
}

export const PASSWORD_RESET_TOKEN_STORE = Symbol(
  'PASSWORD_RESET_TOKEN_STORE',
);
