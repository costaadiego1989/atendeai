import { User } from '../entities/User';

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

export interface IUserRepository {
  saveWithTenant(user: User, tenantId: string): Promise<void>;
  save(user: User): Promise<void>;
  findById(id: string): Promise<User | null>;
  findByIdAndTenant(id: string, tenantId: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findAllByTenant(tenantId: string): Promise<User[]>;
  findOwnerPrincipalByTenantId(tenantId: string): Promise<{
    id: string;
    name: string;
    email: string;
    phone: string;
  } | null>;
  delete(id: string, tenantId: string): Promise<void>;
}
