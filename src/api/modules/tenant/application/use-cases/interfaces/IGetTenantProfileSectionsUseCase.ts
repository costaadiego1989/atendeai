import { OperatingHours } from '../../../domain/entities/Tenant';

export interface TenantProfileMarketingSection {
  companyName: string;
  businessType: string | null;
  description: string | null;
  services: string | null;
  catalogUrl: string | null;
  catalogFiles: string[];
  address: {
    zipcode?: string;
    street?: string;
    streetNumber?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
  } | null;
  operatingHours: OperatingHours | null;
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

export interface TenantProfileTechnicalSection {
  cnpj: string;
  plan: string;
  planStatus: string;
  channels: {
    whatsapp: {
      configured: boolean;
      connected: boolean;
      provider: string | null;
      status: string | null;
      whatsappNumber: string | null;
    };
    instagram: {
      configured: boolean;
      connected: boolean;
      status: string | null;
      instagramAccountId: string | null;
    };
  };
  aiConfig: {
    systemPrompt: string;
    tone: 'FRIENDLY' | 'PROFESSIONAL' | 'CASUAL';
    language: string;
    maxTokensPerResponse: number;
    confidenceThreshold: number;
    escalationMessage?: string | null;
    businessRules: string[];
    updatedAt: Date;
  } | null;
}

export interface GetTenantProfileSectionsOutput {
  id: string;
  marketing: TenantProfileMarketingSection;
  technical: TenantProfileTechnicalSection;
}

export interface IGetTenantProfileSectionsUseCase {
  execute(tenantId: string): Promise<GetTenantProfileSectionsOutput>;
}

export const IGetTenantProfileSectionsUseCase = Symbol(
  'IGetTenantProfileSectionsUseCase',
);
