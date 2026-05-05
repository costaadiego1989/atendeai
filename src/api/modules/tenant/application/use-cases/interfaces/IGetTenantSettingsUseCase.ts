import { OperatingHours } from '../../../domain/entities/Tenant';

export interface GetTenantSettingsOutput {
  id: string;
  support: {
    tenantId: string;
    plan: string;
    planStatus: string;
    createdAt: Date;
  };
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
  recentAuditLogs: Array<{
    id: string;
    eventType: string;
    email?: string | null;
    createdAt: Date;
    metadata: Record<string, unknown>;
  }>;
  channels: {
    whatsapp: {
      configured: boolean;
      connected: boolean;
      provider?: string | null;
      status?: string | null;
      whatsappNumber?: string | null;
    };
    instagram: {
      configured: boolean;
      connected: boolean;
      status?: string | null;
      instagramAccountId?: string | null;
    };
  };
  company: {
    companyName: string;
    cnpj: string;
    businessType?: string | null;
    description?: string | null;
    services?: string | null;
    catalogUrl?: string | null;
    catalogFiles?: string[] | null;
  };
  owner: {
    id: string;
    name: string;
    email: string;
    phone: string;
    cpf?: string | null;
    birthDate?: string | null;
  } | null;
  address: {
    zipcode?: string;
    street?: string;
    streetNumber?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
  } | null;
  branches: Array<{
    id: string;
    name: string;
    phone?: string | null;
    email?: string | null;
    zipcode?: string;
    street?: string;
    streetNumber?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    operatingHours?: OperatingHours | null;
    isHeadquarters: boolean;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
  }>;
  operatingHours?: OperatingHours | null;
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
}

export interface IGetTenantSettingsUseCase {
  execute(tenantId: string): Promise<GetTenantSettingsOutput>;
}

export const IGetTenantSettingsUseCase = Symbol('IGetTenantSettingsUseCase');
