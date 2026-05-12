import { apiClient, BASE_URL } from '@/shared/api/client';
import type {
  ContactAsyncJob,
  Contact,
  ContactDetail,
  ContactImportResult,
  ContactsReport,
  ContactStage,
  ContactTimelineResult,
  PageMeta,
  PaginatedResponse,
} from '@/shared/types';

type ContactListRow = {
  id: string;
  branchId?: string;
  name: string;
  phone: string;
  document?: string;
  stage: ContactStage;
  tags: string[];
  lastInteraction?: string;
};

type ListContactsApiResponse = PaginatedResponse<ContactListRow>;

function parseListContactsPayload(
  raw: unknown,
  page: number,
  limit: number,
): { rows: ContactListRow[]; meta: PageMeta } {
  if (Array.isArray(raw)) {
    const rows = raw as ContactListRow[];
    return {
      rows,
      meta: {
        total: rows.length,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(rows.length / Math.max(limit, 1))),
      },
    };
  }

  if (
    raw &&
    typeof raw === 'object' &&
    Array.isArray((raw as ListContactsApiResponse).data)
  ) {
    const envelope = raw as ListContactsApiResponse;
    const rows = envelope.data;
    const meta = envelope.meta ?? {
      total: rows.length,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(rows.length / Math.max(limit, 1))),
    };
    return { rows, meta };
  }

  return {
    rows: [],
    meta: { total: 0, page, limit, totalPages: 1 },
  };
}

function asArray<T>(value: T[] | { data?: T[]; items?: T[]; previewItems?: T[] } | undefined | null): T[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (Array.isArray(value?.data)) {
    return value.data;
  }

  if (Array.isArray(value?.items)) {
    return value.items;
  }

  if (Array.isArray(value?.previewItems)) {
    return value.previewItems;
  }

  return [];
}

interface ContactDetailApiResponse {
  id: string;
  branchId?: string;
  name: string;
  phone: string;
  document?: string;
  email?: string;
  stage: ContactStage;
  tags: string[];
  notes?: string;
  lastInteraction?: string;
  createdAt: string;
  updatedAt: string;
}

interface ContactTimelineApiResponse {
  contact: {
    id: string;
    name: string;
    phone: string;
    stage: ContactStage;
  };
  entries: Array<{
    timestamp: string;
    type: ContactTimelineResult['entries'][number]['type'];
    title: string;
    details: Record<string, unknown>;
  }>;
}

interface OpenConversationApiResponse {
  conversationId: string;
  contactId: string;
  channel: 'WHATSAPP' | 'INSTAGRAM';
  status: 'ACTIVE' | 'PENDING_HUMAN' | 'ARCHIVED';
  created: boolean;
}

export interface CreateContactInput {
  name: string;
  phone: string;
  document: string;
  email?: string;
  tags?: string[];
  notes?: string;
}

export interface UpdateContactInput {
  name?: string;
  document?: string;
  email?: string;
  tags?: string[];
  notes?: string;
}

export interface ImportContactsInput {
  rawText: string;
  defaultStage?: ContactStage;
  defaultTags?: string[];
}

export interface GenerateContactsReportInput {
  tags?: string[];
  stages?: ContactStage[];
  timelineTypes?: Array<'MESSAGING' | 'RECOVERY' | 'PAYMENT' | 'SCHEDULING'>;
  channels?: Array<'WHATSAPP' | 'INSTAGRAM' | 'CRM'>;
  dateFrom?: string;
  dateTo?: string;
  branchId?: string | null;
}

function toIsoString(value?: string) {
  return value ? new Date(value).toISOString() : undefined;
}

function mapContact(contact: {
  id: string;
  branchId?: string | null;
  name: string;
  phone: string;
  document?: string;
  email?: string;
  stage: ContactStage;
  tags?: string[];
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  lastInteraction?: string;
}): Contact {
  return {
    id: contact.id,
    branchId: contact.branchId ?? null,
    name: contact.name,
    phone: contact.phone,
    document: contact.document,
    email: contact.email,
    stage: contact.stage,
    tags: contact.tags ?? [],
    notes: contact.notes,
    createdAt: toIsoString(contact.createdAt) ?? new Date().toISOString(),
    updatedAt: toIsoString(contact.updatedAt) ?? new Date().toISOString(),
    lastInteraction: toIsoString(contact.lastInteraction),
  };
}

function normalizeImportResult(response: ContactImportResult | Record<string, unknown>): ContactImportResult {
  const result = response as ContactImportResult & {
    data?: ContactImportResult['items'];
    previewItems?: ContactImportResult['items'];
  };

  return {
    totalRows: Number(result.totalRows ?? 0),
    processed: Number(result.processed ?? 0),
    created: Number(result.created ?? 0),
    updated: Number(result.updated ?? 0),
    skipped: Number(result.skipped ?? 0),
    failed: Number(result.failed ?? 0),
    items: asArray(result.items ?? result.previewItems ?? result.data),
  };
}

export const contactsService = {
  async listContacts(
    tenantId: string,
    filters?: {
      page?: number;
      limit?: number;
      stage?: ContactStage;
      tag?: string;
      branchId?: string | null;
    },
  ): Promise<{
    data: Contact[];
    meta: ListContactsApiResponse['meta'];
  }> {
    const page = filters?.page ?? 1;
    const limit = filters?.limit ?? 200;

    const raw = await apiClient.get<unknown>(`/tenants/${tenantId}/contacts`, {
      page,
      limit,
      stage: filters?.stage,
      tag: filters?.tag,
      branchId: filters?.branchId ?? undefined,
    });

    const { rows: contacts, meta } = parseListContactsPayload(raw, page, limit);

    return {
      data: contacts.map((contact) =>
        mapContact({
          ...contact,
          createdAt: contact.lastInteraction,
          updatedAt: contact.lastInteraction,
        }),
      ),
      meta,
    };
  },

  async createContact(
    tenantId: string,
    input: CreateContactInput,
    branchId?: string | null,
  ): Promise<Contact> {
    const response = await apiClient.post<{
      id: string;
      tenantId: string;
      branchId?: string;
      name: string;
      phone: string;
      document?: string;
      stage: ContactStage;
      tags: string[];
      createdAt: string;
    }>(branchId ? `/tenants/${tenantId}/contacts?branchId=${encodeURIComponent(branchId)}` : `/tenants/${tenantId}/contacts`, input);

    return mapContact({
      ...response,
      updatedAt: response.createdAt,
    });
  },

  async getContact(tenantId: string, contactId: string): Promise<ContactDetail> {
    const response = await apiClient.get<ContactDetailApiResponse>(
      `/tenants/${tenantId}/contacts/${contactId}`,
    );

    return {
      ...mapContact(response),
      lastInteraction: toIsoString(response.lastInteraction),
    };
  },

  async updateContact(
    tenantId: string,
    contactId: string,
    input: UpdateContactInput,
  ): Promise<ContactDetail> {
    const response = await apiClient.patch<{
      id: string;
      name: string;
      phone: string;
      document?: string;
      email?: string;
      stage: ContactStage;
      tags: string[];
      notes?: string;
    }>(`/tenants/${tenantId}/contacts/${contactId}`, input);

    return {
      ...mapContact({
        ...response,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    };
  },

  async updateContactStage(
    tenantId: string,
    contactId: string,
    stage: ContactStage,
  ): Promise<{ id: string; stage: ContactStage; previousStage: ContactStage }> {
    return apiClient.patch(`/tenants/${tenantId}/contacts/${contactId}/stage`, {
      stage,
    });
  },

  async getContactTimeline(
    tenantId: string,
    contactId: string,
  ): Promise<ContactTimelineResult> {
    const response = await apiClient.get<ContactTimelineApiResponse>(
      `/tenants/${tenantId}/contacts/${contactId}/timeline`,
    );

    return {
      contact: response.contact,
      entries: asArray(response.entries).map((entry) => ({
        ...entry,
        timestamp: new Date(entry.timestamp).toISOString(),
      })),
    };
  },

  async deleteContact(tenantId: string, contactId: string): Promise<void> {
    await apiClient.post(`/tenants/${tenantId}/contacts/${contactId}/delete`);
  },

  async openConversation(
    tenantId: string,
    contactId: string,
    channel: 'WHATSAPP' | 'INSTAGRAM' = 'WHATSAPP',
  ): Promise<OpenConversationApiResponse> {
    return apiClient.post(`/tenants/${tenantId}/conversations/open-by-contact`, {
      contactId,
      channel,
    });
  },

  async importContacts(
    tenantId: string,
    input: ImportContactsInput,
    branchId?: string | null,
  ): Promise<ContactImportResult> {
    const response = await apiClient.post<ContactImportResult>(
      branchId
        ? `/tenants/${tenantId}/contacts/import?branchId=${encodeURIComponent(branchId)}`
        : `/tenants/${tenantId}/contacts/import`,
      input,
    );

    return normalizeImportResult(response);
  },

  async startImportJob(
    tenantId: string,
    input: ImportContactsInput,
    branchId?: string | null,
  ): Promise<ContactAsyncJob> {
    return apiClient.post<ContactAsyncJob>(
      branchId
        ? `/tenants/${tenantId}/contacts/import-jobs?branchId=${encodeURIComponent(branchId)}`
        : `/tenants/${tenantId}/contacts/import-jobs`,
      input,
    );
  },

  async generateReport(
    tenantId: string,
    input: GenerateContactsReportInput,
  ): Promise<ContactsReport> {
    const response = await apiClient.post<ContactsReport>(
      input.branchId
        ? `/tenants/${tenantId}/contacts/reports?branchId=${encodeURIComponent(input.branchId)}`
        : `/tenants/${tenantId}/contacts/reports`,
      {
        stages: input.stages,
        tags: input.tags,
        timelineTypes: input.timelineTypes,
        channels: input.channels,
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
      },
    );

    return {
      ...response,
      contacts: asArray(response.contacts).map((contact) => ({
        ...contact,
        createdAt: toIsoString(contact.createdAt) ?? new Date().toISOString(),
        updatedAt: toIsoString(contact.updatedAt) ?? new Date().toISOString(),
        lastInteraction: toIsoString(contact.lastInteraction),
        lastTimelineEventAt: toIsoString(contact.lastTimelineEventAt),
      })),
      generatedAt: toIsoString(response.generatedAt) ?? new Date().toISOString(),
    };
  },

  async startReportJob(
    tenantId: string,
    input: GenerateContactsReportInput,
  ): Promise<ContactAsyncJob> {
    return apiClient.post<ContactAsyncJob>(
      input.branchId
        ? `/tenants/${tenantId}/contacts/report-jobs?branchId=${encodeURIComponent(input.branchId)}`
        : `/tenants/${tenantId}/contacts/report-jobs`,
      {
        stages: input.stages,
        tags: input.tags,
        timelineTypes: input.timelineTypes,
        channels: input.channels,
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
      },
    );
  },

  async listAsyncJobs(tenantId: string): Promise<ContactAsyncJob[]> {
    const response = await apiClient.get<ContactAsyncJob[] | { data?: ContactAsyncJob[] }>(
      `/tenants/${tenantId}/contacts/jobs`,
    );
    return Array.isArray(response) ? response : asArray(response.data);
  },

  async downloadAsyncJobFile(
    tenantId: string,
    jobId: string,
    fallbackFileName?: string,
  ): Promise<void> {
    const anchor = document.createElement('a');
    anchor.href = `${BASE_URL}/tenants/${tenantId}/contacts/jobs/${jobId}/download`;
    anchor.download = fallbackFileName ?? `contatos-${jobId}.csv`;

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  },
};
