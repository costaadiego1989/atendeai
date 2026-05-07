import { apiClient } from '@/shared/api/client';
import { formatCurrencyInput, parseCurrencyInput } from '@/shared/lib/masks';
import type { ProposalItemDraft, ProposalItemRecord, ProposalRecord } from '../types';

interface ProposalApiResponse {
  id: string;
  tenantId: string;
  contactId: string;
  userId: string;
  title: string;
  description?: string | null;
  benefits?: string | null;
  items: Array<ProposalItemRecord & { subtotal?: number }>;
  totalAmount: number;
  status: ProposalRecord['status'];
  validUntil?: string | null;
  scheduledAt?: string | null;
  pdfUrl?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProposalPayload {
  tenantId: string;
  contactId: string;
  userId: string;
  title: string;
  description?: string;
  benefits?: string;
  metadata?: Record<string, unknown>;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    description?: string;
  }>;
  validUntil?: string;
}

export interface ProposalUpdatePayload extends Partial<ProposalPayload> {}

export interface ProposalSendResult {
  success: boolean;
  conversationId: string;
  messageId: string;
  publicUrl: string;
}

function toIsoString(value?: string | null) {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function normalizeItem(item: ProposalItemRecord & { subtotal?: number }): ProposalItemRecord {
  return {
    name: item.name,
    quantity: Number(item.quantity ?? 0),
    unitPrice: Number(item.unitPrice ?? 0),
    description: item.description || undefined,
    subtotal:
      typeof item.subtotal === 'number'
        ? item.subtotal
        : Number(item.unitPrice ?? 0) * Number(item.quantity ?? 0),
  };
}

function normalizeMetadata(metadata: unknown): Record<string, unknown> | null {
  if (!metadata) {
    return null;
  }

  if (typeof metadata === 'string') {
    try {
      const parsed = JSON.parse(metadata);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }

  if (typeof metadata === 'object' && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>;
  }

  return null;
}

function normalizeProposal(raw: ProposalApiResponse): ProposalRecord {
  return {
    id: raw.id,
    tenantId: raw.tenantId,
    contactId: raw.contactId,
    userId: raw.userId,
    title: raw.title,
    description: raw.description ?? null,
    benefits: raw.benefits ?? null,
    items: Array.isArray(raw.items) ? raw.items.map(normalizeItem) : [],
    totalAmount: Number(raw.totalAmount ?? 0),
    status: raw.status,
    validUntil: toIsoString(raw.validUntil) ?? null,
    scheduledAt: toIsoString(raw.scheduledAt) ?? null,
    pdfUrl: raw.pdfUrl ?? null,
    notes: raw.notes ?? null,
    metadata: normalizeMetadata(raw.metadata),
    createdAt: toIsoString(raw.createdAt) ?? new Date().toISOString(),
    updatedAt: toIsoString(raw.updatedAt) ?? new Date().toISOString(),
  };
}

function asArray<T>(value: T[] | { data?: T[] } | undefined | null): T[] {
  if (Array.isArray(value)) {
    return value;
  }

  return Array.isArray(value?.data) ? value.data : [];
}

function normalizeFormItem(item: ProposalItemDraft) {
  const parsedQuantity = Number(item.quantity || 0);
  const parsedUnitPrice = Number(parseCurrencyInput(item.unitPrice) ?? 0);

  return {
    name: item.name.trim(),
    quantity: Number.isFinite(parsedQuantity) ? parsedQuantity : 0,
    unitPrice: Number.isFinite(parsedUnitPrice) ? parsedUnitPrice : 0,
    description: item.description.trim() || undefined,
  };
}

export const proposalsService = {
  async listProposals(tenantId: string): Promise<ProposalRecord[]> {
    const response = await apiClient.get<ProposalApiResponse[] | { data?: ProposalApiResponse[] }>(
      '/proposals',
      { tenantId },
      { unwrapData: false },
    );

    return asArray(response).map(normalizeProposal);
  },

  async getProposal(tenantId: string, proposalId: string): Promise<ProposalRecord> {
    const response = await apiClient.get<ProposalApiResponse>(`/proposals/${proposalId}`, {
      tenantId,
    }, { unwrapData: false });

    return normalizeProposal(response);
  },

  async createProposal(
    input: ProposalPayload,
  ): Promise<{ id: string; success: boolean }> {
    return apiClient.post('/proposals', {
      ...input,
      description: input.description?.trim() || undefined,
      benefits: input.benefits?.trim() || undefined,
      validUntil: toIsoString(input.validUntil),
      metadata: input.metadata,
      items: input.items.map(normalizeFormItem),
    });
  },

  async updateProposal(
    proposalId: string,
    input: ProposalUpdatePayload,
  ): Promise<{ id: string; success: boolean }> {
    return apiClient.patch(`/proposals/${proposalId}`, {
      ...input,
      description: input.description?.trim() || undefined,
      benefits: input.benefits?.trim() || undefined,
      validUntil: toIsoString(input.validUntil),
      metadata: input.metadata,
      items: input.items?.map(normalizeFormItem),
    });
  },

  async deleteProposal(proposalId: string): Promise<{ success: boolean }> {
    return apiClient.delete(`/proposals/${proposalId}`);
  },

  async generateProposalPdf(proposalId: string): Promise<{ success: boolean; pdfUrl?: string }> {
    return apiClient.post(`/proposals/${proposalId}/pdf`);
  },

  async sendProposalToConversation(proposalId: string): Promise<ProposalSendResult> {
    return apiClient.post(`/proposals/${proposalId}/send`);
  },

  async scheduleProposalDelivery(
    proposalId: string,
    scheduledAt: string,
  ): Promise<{ success: boolean; scheduledAt: string }> {
    return apiClient.post(`/proposals/${proposalId}/schedule`, {
      scheduledAt: toIsoString(scheduledAt) ?? scheduledAt,
    });
  },

  formatItemPriceInput(value: string) {
    return formatCurrencyInput(value);
  },
};
