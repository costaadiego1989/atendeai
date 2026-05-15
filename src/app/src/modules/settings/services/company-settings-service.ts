import { apiClient } from '@/shared/api/client';
import type {
  AIConfig,
  OperatingHours,
  Tenant,
  TenantBillingAccess,
  TenantBranch,
  TenantOwner,
} from '@/shared/types';

interface BackendTenantSettings {
  id: string;
  support: {
    tenantId: string;
    plan: string;
    planStatus: string;
    createdAt: string;
  };
  billingAccess?: TenantBillingAccess;
  recentAuditLogs: Array<{
    id: string;
    eventType: string;
    email?: string | null;
    createdAt: string;
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
  aiConfig?: {
    systemPrompt: string;
    tone: 'FRIENDLY' | 'PROFESSIONAL' | 'CASUAL';
    language: string;
    maxTokensPerResponse: number;
    confidenceThreshold: number;
    escalationMessage?: string | null;
    businessRules: string[];
    updatedAt: string;
  } | null;
  address?: {
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
    cnpj?: string | null;
    phone?: string | null;
    email?: string | null;
    whatsappNumber?: string | null;
    instagramAccountId?: string | null;
    whatsAppConfigOverride?: {
      provider: 'BUBBLEWHATS' | 'TWILIO' | 'D360';
      credentials: Record<string, string>;
      webhookSecret?: string | null;
    } | null;
    zipcode?: string;
    street?: string;
    streetNumber?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    operatingHours?: OperatingHours | null;
    isHeadquarters: boolean;
    active: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
  operatingHours?: OperatingHours | null;
  owner?: TenantOwner | null;
  promotions?: Array<{
    id: string;
    title: string;
    description: string;
    value: string;
    imageUrl?: string;
    expiresAt?: string;
    assignedUserId?: string;
    assignedUserName?: string;
  }> | null;
}

export interface CreatePromotionInput {
  title: string;
  description: string;
  value: string;
  expiresAt?: string;
  assignedUserId?: string;
}

export interface UpdatePromotionInput extends CreatePromotionInput {
  promotionId: string;
}

export interface UpdateCompanySettingsInput {
  ownerBirthDate?: string | null;
  description?: string | null;
  services?: string | null;
  zipcode?: string | null;
  street?: string | null;
  streetNumber?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  catalogUrl?: string | null;
  catalogFiles?: string[] | null;
  operatingHours?: OperatingHours | null;
}

export interface UpdateAISettingsInput {
  systemPrompt: string;
  tone: 'FRIENDLY' | 'PROFESSIONAL' | 'CASUAL';
  language?: string;
  maxTokensPerResponse?: number;
  confidenceThreshold?: number;
  escalationMessage?: string | null;
  businessRules?: string[];
}

export interface TenantBranchInput {
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

export interface TenantPDFResume {
  id: string;
  tenantId: string;
  fileName: string;
  fileUrl: string | null;
  checksum: string | null;
  summaries: string[];
  status: 'PROCESSING' | 'EXTRACTING' | 'CHUNKING' | 'EMBEDDING' | 'READY' | 'ERROR' | string;
  error: string | null;
  canSendIt: boolean;
  chunkCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TenantProfileSectionRow {
  id: string;
  title: string;
  completed: boolean;
}

export interface TenantOnboardingChecklistRow {
  id: string;
  title: string;
  completed: boolean;
}

function mapBranchInput(input: TenantBranchInput) {
  return {
    name: input.name,
    cnpj: input.cnpj,
    phone: input.phone,
    email: input.email,
    whatsappNumber: input.whatsappNumber,
    instagramAccountId: input.instagramAccountId,
    whatsAppProvider: input.whatsAppConfigOverride?.provider,
    whatsAppCredentials: input.whatsAppConfigOverride?.credentials,
    whatsAppWebhookSecret: input.whatsAppConfigOverride?.webhookSecret,
    zipcode: input.zipcode,
    street: input.street,
    streetNumber: input.streetNumber,
    neighborhood: input.neighborhood,
    city: input.city,
    state: input.state,
    operatingHours: input.operatingHours,
    isHeadquarters: input.isHeadquarters,
    active: input.active,
  };
}

function mapTenantSettings(input: BackendTenantSettings): Tenant {
  const mappedAiConfig: AIConfig | undefined = input.aiConfig
    ? {
      basePrompt: input.aiConfig.systemPrompt,
      tone: input.aiConfig.tone.toLowerCase() as AIConfig['tone'],
      language: input.aiConfig.language,
      handoffConfidence: input.aiConfig.confidenceThreshold,
      escalationMessage: input.aiConfig.escalationMessage ?? undefined,
      businessRules: input.aiConfig.businessRules ?? [],
      maxTokensPerResponse: input.aiConfig.maxTokensPerResponse,
      updatedAt: input.aiConfig.updatedAt,
    }
    : undefined;

  return {
    id: input.id,
    name: input.company.companyName,
    cnpj: input.company.cnpj,
    plan: input.support.plan,
    planStatus: input.support.planStatus,
    createdAt: input.support.createdAt,
    billingAccess: input.billingAccess,
    supportMeta: input.support,
    recentAuditLogs: input.recentAuditLogs ?? [],
    businessType: input.company.businessType ?? undefined,
    description: input.company.description ?? undefined,
    services: input.company.services ?? undefined,
    catalogUrl: input.company.catalogUrl ?? undefined,
    catalogFiles: input.company.catalogFiles ?? [],
    zipcode: input.address?.zipcode,
    street: input.address?.street,
    streetNumber: input.address?.streetNumber,
    neighborhood: input.address?.neighborhood,
    city: input.address?.city,
    state: input.address?.state,
    branches: (input.branches ?? []) as TenantBranch[],
    operatingHours: input.operatingHours ?? undefined,
    owner: input.owner ?? undefined,
    channels: input.channels,
    aiConfig: mappedAiConfig,
    promotions: (input.promotions ?? []).map((promotion) => ({
      id: promotion.id,
      title: promotion.title,
      description: promotion.description,
      value: promotion.value,
      expiresAt: promotion.expiresAt,
      assignedUserId: promotion.assignedUserId,
      assignedUserName: promotion.assignedUserName,
      active: promotion.expiresAt ? new Date(promotion.expiresAt) >= new Date() : true,
      discountType: promotion.value?.includes('%') ? 'PERCENTAGE' : 'FIXED',
      validTo: promotion.expiresAt,
    })),
  };
}

function extractUnknownRows(raw: unknown): unknown[] {
  if (Array.isArray(raw)) {
    return raw;
  }

  if (raw && typeof raw === 'object') {
    const envelope = raw as Record<string, unknown>;
    if (Array.isArray(envelope.data)) {
      return envelope.data;
    }
    if (Array.isArray(envelope.items)) {
      return envelope.items;
    }
    if (Array.isArray(envelope.checklist)) {
      return envelope.checklist;
    }
    if (Array.isArray(envelope.sections)) {
      return envelope.sections;
    }
  }

  return [];
}

/**
 * Extracts profile section rows from the backend response shape:
 * `{ id, marketing: { companyName, businessType, ... }, technical: { cnpj, plan, ... } }`
 *
 * Each field with a truthy value counts as "completed" for that section.
 */
function extractProfileSectionRows(raw: unknown): TenantProfileSectionRow[] {
  if (Array.isArray(raw)) {
    return raw
      .map(normalizeProfileSectionRow)
      .filter((row): row is TenantProfileSectionRow => row !== null);
  }

  if (!raw || typeof raw !== 'object') {
    return [];
  }

  const envelope = raw as Record<string, unknown>;

  // If the backend returns a flat array envelope, delegate to generic extractor
  const flatRows = extractUnknownRows(raw);
  if (flatRows.length > 0) {
    return flatRows
      .map(normalizeProfileSectionRow)
      .filter((row): row is TenantProfileSectionRow => row !== null);
  }

  // Handle structured response: { marketing: {...}, technical: {...} }
  const sections: TenantProfileSectionRow[] = [];
  const sectionLabels: Record<string, string> = {
    companyName: 'Nome da empresa',
    businessType: 'Tipo de negócio',
    description: 'Descrição',
    services: 'Serviços',
    catalog: 'Catálogo',
    catalogUrl: 'URL do catálogo',
    catalogFiles: 'Arquivos do catálogo',
    address: 'Endereço',
    operatingHours: 'Horário de funcionamento',
    promotions: 'Promoções',
    cnpj: 'CNPJ',
    plan: 'Plano',
    planStatus: 'Status do plano',
    channels: 'Canais conectados',
    aiConfig: 'Configuração IA',
  };

  const marketing = envelope.marketing as Record<string, unknown> | undefined;
  const technical = envelope.technical as Record<string, unknown> | undefined;

  if (marketing && typeof marketing === 'object') {
    for (const [key, value] of Object.entries(marketing)) {
      const label = sectionLabels[key] ?? key;
      const completed = Array.isArray(value) ? value.length > 0 : Boolean(value);
      sections.push({ id: `marketing.${key}`, title: label, completed });
    }
  }

  if (technical && typeof technical === 'object') {
    for (const [key, value] of Object.entries(technical)) {
      const label = sectionLabels[key] ?? key;
      const completed = Array.isArray(value) ? value.length > 0 : Boolean(value);
      sections.push({ id: `technical.${key}`, title: label, completed });
    }
  }

  return sections;
}

function normalizeProfileSectionRow(item: unknown): TenantProfileSectionRow | null {
  if (!item || typeof item !== 'object') {
    return null;
  }
  const row = item as Record<string, unknown>;
  const idRaw =
    typeof row.id === 'string'
      ? row.id
      : typeof row.slug === 'string'
        ? row.slug
        : '';
  const titleRaw =
    typeof row.title === 'string'
      ? row.title
      : typeof row.label === 'string'
        ? row.label
        : typeof row.name === 'string'
          ? row.name
          : '';
  const completed = Boolean(row.completed ?? row.done ?? row.isComplete ?? row.checked);

  if (!idRaw && !titleRaw) {
    return null;
  }

  return {
    id: idRaw || titleRaw,
    title: titleRaw || idRaw,
    completed,
  };
}

function normalizeOnboardingChecklistRow(item: unknown): TenantOnboardingChecklistRow | null {
  if (!item || typeof item !== 'object') {
    return null;
  }
  const row = item as Record<string, unknown>;
  const idRaw =
    typeof row.id === 'string'
      ? row.id
      : typeof row.key === 'string'
        ? row.key
        : '';
  const titleRaw =
    typeof row.title === 'string'
      ? row.title
      : typeof row.label === 'string'
        ? row.label
        : typeof row.description === 'string'
          ? row.description
          : '';
  const completed = Boolean(row.completed ?? row.done ?? row.isComplete ?? row.checked);

  if (!idRaw && !titleRaw) {
    return null;
  }

  return {
    id: idRaw || titleRaw,
    title: titleRaw || idRaw,
    completed,
  };
}

export const companySettingsService = {
  async getTenantSettings(tenantId: string): Promise<Tenant> {
    const response = await apiClient.get<BackendTenantSettings>(`/tenants/${tenantId}/settings`);
    return mapTenantSettings(response);
  },

  async updateBusinessData(
    tenantId: string,
    input: UpdateCompanySettingsInput,
  ): Promise<{ success: boolean }> {
    return apiClient.put<{ success: boolean }>(
      `/tenants/${tenantId}/business-data`,
      input,
    );
  },

  async listPDFResumes(tenantId: string): Promise<TenantPDFResume[]> {
    return apiClient.get<TenantPDFResume[]>(`/tenants/${tenantId}/pdf-resumes`);
  },

  async upsertPDFResume(
    tenantId: string,
    input: {
      fileName: string;
      fileUrl?: string | null;
      checksum?: string | null;
      extractedText?: string | null;
      summaries?: string[];
      canSendIt?: boolean;
    },
  ): Promise<TenantPDFResume> {
    return apiClient.post<TenantPDFResume>(`/tenants/${tenantId}/pdf-resumes`, input);
  },

  async updateAIConfig(
    tenantId: string,
    input: UpdateAISettingsInput,
  ): Promise<{ success: boolean }> {
    return apiClient.put<{ success: boolean }>(
      `/tenants/${tenantId}/ai-config`,
      input,
    );
  },

  async addPromotion(
    tenantId: string,
    input: CreatePromotionInput,
  ): Promise<{ success: boolean }> {
    return apiClient.post<{ success: boolean }>(`/tenants/${tenantId}/promotions`, input);
  },

  async updatePromotion(
    tenantId: string,
    input: UpdatePromotionInput,
  ): Promise<{ success: boolean }> {
    return apiClient.put<{ success: boolean }>(
      `/tenants/${tenantId}/promotions/${input.promotionId}`,
      {
        title: input.title,
        description: input.description,
        value: input.value,
        expiresAt: input.expiresAt,
        assignedUserId: input.assignedUserId,
      },
    );
  },

  async deletePromotion(
    tenantId: string,
    promotionId: string,
  ): Promise<{ success: boolean }> {
    return apiClient.delete<{ success: boolean }>(
      `/tenants/${tenantId}/promotions/${promotionId}`,
    );
  },

  async createBranch(
    tenantId: string,
    input: TenantBranchInput,
  ): Promise<{ success: boolean }> {
    return apiClient.post<{ success: boolean }>(
      `/tenants/${tenantId}/branches`,
      mapBranchInput(input),
    );
  },

  async updateBranch(
    tenantId: string,
    branchId: string,
    input: TenantBranchInput,
  ): Promise<{ success: boolean }> {
    return apiClient.put<{ success: boolean }>(
      `/tenants/${tenantId}/branches/${branchId}`,
      mapBranchInput(input),
    );
  },

  async deleteBranch(
    tenantId: string,
    branchId: string,
  ): Promise<{ success: boolean }> {
    return apiClient.delete<{ success: boolean }>(
      `/tenants/${tenantId}/branches/${branchId}`,
    );
  },

  async getProfileSections(tenantId: string): Promise<TenantProfileSectionRow[]> {
    const raw = await apiClient.get<unknown>(`/tenants/${tenantId}/profile-sections`);
    return extractProfileSectionRows(raw);
  },

  async getOnboardingChecklist(tenantId: string): Promise<TenantOnboardingChecklistRow[]> {
    const raw = await apiClient.get<unknown>(`/tenants/${tenantId}/onboarding-checklist`);
    return extractUnknownRows(raw)
      .map(normalizeOnboardingChecklistRow)
      .filter((row): row is TenantOnboardingChecklistRow => row !== null);
  },
};
