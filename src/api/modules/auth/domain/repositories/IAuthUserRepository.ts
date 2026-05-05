import { AuthUser } from '../entities/AuthUser';

export const AUTH_USER_REPOSITORY = Symbol('IAuthUserRepository');

export interface IAuthUserRepository {
  findByEmail(email: string): Promise<AuthUser | null>;
  findById(id: string): Promise<AuthUser | null>;
  updatePassword(userId: string, passwordHash: string): Promise<void>;
}
