import { Tenant } from '../entities/Tenant.js';
import { OperatingHours } from '../entities/Tenant.js';
import { TenantBranch } from '../entities/TenantBranch.js';

export interface SaveTenantBranchInput {
  tenantId: string;
  name: string;
  cnpj: string | null;
  phone?: string | null;
  email?: string | null;
  whatsappNumber?: string | null;
  instagramAccountId?: string | null;
  whatsAppConfigOverride?: {
    provider: 'BUBBLEWHATS' | 'TWILIO' | 'D360';
    credentials: Record<string, string>;
    webhookSecret?: string | null;
  } | null;
  zipcode?: string | null;
  street?: string | null;
  streetNumber?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  operatingHours?: OperatingHours | null;
  isHeadquarters?: boolean;
  active?: boolean;
}

export interface ITenantRepository {
  save(tenant: Tenant): Promise<void>;
  findById(id: string): Promise<Tenant | null>;
  findCompanyNameById?(id: string): Promise<string | null>;
  findByCnpj(cnpj: string): Promise<Tenant | null>;
  findByWhatsAppNumber(whatsappNumber: string): Promise<Tenant | null>;
  findByApiKey(apiKey: string): Promise<Tenant | null>;
  findAll(
    page: number,
    limit: number,
  ): Promise<{ data: Tenant[]; total: number }>;
  exists(cnpj: string): Promise<boolean>;
  listBranches(tenantId: string): Promise<TenantBranch[]>;
  createBranch(input: SaveTenantBranchInput): Promise<TenantBranch>;
  updateBranch(
    branchId: string,
    input: SaveTenantBranchInput,
  ): Promise<TenantBranch>;
  deleteBranch(tenantId: string, branchId: string): Promise<void>;
  findBranchByWhatsAppNumber?(
    whatsappNumber: string,
  ): Promise<{ tenantId: string; branch: TenantBranch } | null>;
  findBranchByInstagramAccountId?(
    instagramAccountId: string,
  ): Promise<{ tenantId: string; branch: TenantBranch } | null>;
}

export const TENANT_REPOSITORY = Symbol('TENANT_REPOSITORY');
