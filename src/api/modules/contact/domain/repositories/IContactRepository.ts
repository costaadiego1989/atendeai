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
  /**
   * C3 fix: tenant-scoped lookup. Returns only contacts for the given tenant.
   * Use this for all tenant-aware operations.
   */
  findAllByPhone(
    tenantId: string,
    phone: string,
  ): Promise<Array<{ tenantId: string; contactId: string }>>;
  /**
   * Cross-tenant lookup for system-level events (e.g. Meta opt-out webhooks).
   * Must NOT be used in any tenant-scoped flow.
   */
  findAllByPhoneAcrossAllTenants(
    phone: string,
  ): Promise<Array<{ tenantId: string; contactId: string }>>;
}

export const CONTACT_REPOSITORY = Symbol('IContactRepository');
