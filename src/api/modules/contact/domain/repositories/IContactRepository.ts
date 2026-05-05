import { Contact } from '../entities/Contact';

export interface IContactRepository {
  save(contact: Contact): Promise<void>;
  findById(tenantId: string, id: string): Promise<Contact | null>;
  findByPhone(tenantId: string, phone: string): Promise<Contact | null>;
  findAllByTenant(
    tenantId: string,
    filters?: {
      page?: number;
      limit?: number;
      stage?: string;
      tag?: string;
      branchId?: string;
    },
  ): Promise<{ data: Contact[]; total: number }>;
  delete(tenantId: string, id: string): Promise<void>;
}

export const CONTACT_REPOSITORY = Symbol('IContactRepository');
