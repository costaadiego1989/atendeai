import { OperatingHours } from '../../../domain/entities/Tenant';

export interface GetTenantDetailsOutput {
  id: string;
  companyName: string;
  cnpj: string;
  plan: string;
  billingAccess?: {
    subscriptionId?: string | null;
    plan?: string | null;
    status?: string | null;
    pricing: {
      baseMonthlyPrice: number;
      addonsMonthlyPrice: number;
      totalMonthlyPrice: number;
      pricingVersion?: string | null;
    };
    includedModules: string[];
    addonModules: string[];
    enabledModules: string[];
    moduleAccess: Record<string, boolean>;
  };
  businessType?: string | null;
  description?: string | null;
  services?: string | null;
  catalogUrl?: string | null;
  aiConfig?: {
    systemPrompt: string;
    tone: 'FRIENDLY' | 'PROFESSIONAL' | 'CASUAL';
    language: string;
    maxTokensPerResponse: number;
    confidenceThreshold: number;
    escalationMessage?: string | null;
    businessRules: string[];
    updatedAt: Date;
  } | null;
  createdAt: Date;
  address: {
    zipcode?: string;
    street?: string;
    streetNumber?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
  } | null;
  operatingHours?: OperatingHours | null;
  promotions: Array<{
    id: string;
    title: string;
    description: string;
    value: string;
    imageUrl?: string;
    expiresAt?: string;
    assignedUserId?: string;
    assignedUserName?: string;
  }>;
  owner: {
    name: string;
    email: string;
    phone: string;
    cpf?: string | null;
    birthDate?: string | null;
  } | null;
}

export interface IGetTenantDetailsUseCase {
  execute(tenantId: string): Promise<GetTenantDetailsOutput>;
}

export const IGetTenantDetailsUseCase = Symbol('IGetTenantDetailsUseCase');
