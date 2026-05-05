import { apiClient, BASE_URL } from '@/shared/api/client';
import type {
  RecoveryAsyncJob,
  RecoveryCase,
  RecoverySource,
  RecoveryStatus,
} from '@/shared/types';

export type RecoveryBillingType = 'UNDEFINED' | 'BOLETO' | 'CREDIT_CARD' | 'PIX';

export type RecoveryRecurringChargeStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';

export interface RecoveryRecurringCharge {
  id: string;
  tenantId: string;
  branchId?: string | null;
  caseId: string;
  status: RecoveryRecurringChargeStatus;
  billingType: RecoveryBillingType;
  intervalDays: number;
  maxOccurrences?: number | null;
  occurrencesSent: number;
  firstRunAt: string;
  nextRunAt?: string | null;
  lastRunAt?: string | null;
  messageTemplate?: string | null;
  lastError?: string | null;
  createdByUserId?: string | null;
  createdByUserEmail?: string | null;
  cancelledAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface RecoveryCaseApiResponse {
  id: string;
  tenantId?: string;
  branchId?: string | null;
  contactId?: string | null;
  debtorName: string;
  debtorCompanyName?: string | null;
  debtorDocument?: string | null;
  phone: string;
  externalReference?: string | null;
  paymentReference?: string | null;
  source: RecoverySource;
  status: RecoveryStatus;
  chargeType?: string | null;
  chargeTitle?: string | null;
  chargeDescription?: string | null;
  referencePeriod?: string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  relatedEntityLabel?: string | null;
  amountDue?: string | number | null;
  dueDate?: string | null;
  assignedTags?: string[] | null;
  lastContactedAt?: string | null;
  nextActionAt?: string | null;
  paidAt?: string | null;
  suggestedReply?: string | null;
  suggestedNextAction?: string | null;
  guidanceGeneratedAt?: string | null;
  playbookId?: string | null;
  playbookPhaseIndex?: number;
  lastPlaybookPhaseExecutedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RecoveryCaseDetail extends RecoveryCase {
  contactId?: string | null;
}

export interface CreateRecoveryCaseInput {
  branchId?: string;
  contactId?: string;
  debtorName?: string;
  phone?: string;
  debtorCompanyName?: string;
  debtorDocument?: string;
  chargeType?: string;
  chargeTitle?: string;
  chargeDescription?: string;
  referencePeriod?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  relatedEntityLabel?: string;
  amountDue?: string;
  dueDate?: string;
  externalReference?: string;
  assignedTags?: string[];
}

export interface TriggerRecoveryOutreachInput {
  messageText?: string;
  previewOnly?: boolean;
  generateWithAI?: boolean;
  followPlaybook?: boolean;
}

export type RecoveryPlaybookPhaseMode = 'AI' | 'TEMPLATE';

export interface RecoveryPlaybookRecord {
  id: string;
  tenantId: string;
  branchId: string | null;
  name: string;
  version: number;
  active: boolean;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RecoveryPlaybookPhase {
  id: string;
  playbookId: string;
  sortOrder: number;
  channel: string;
  minDelayHoursSincePrevious: number;
  minDaysOverdue: number;
  mode: RecoveryPlaybookPhaseMode;
  templateBody: string | null;
}

export interface RecoveryPlaybookWithPhases {
  playbook: RecoveryPlaybookRecord;
  phases: RecoveryPlaybookPhase[];
}

export interface CreateRecoveryPlaybookPhaseInput {
  sortOrder: number;
  channel?: string;
  minDelayHoursSincePrevious?: number;
  minDaysOverdue?: number;
  mode: RecoveryPlaybookPhaseMode;
  templateBody?: string | null;
}

export interface CreateRecoveryPlaybookInput {
  branchId?: string | null;
  name: string;
  phases: CreateRecoveryPlaybookPhaseInput[];
}

export interface SeedDefaultRecoveryPlaybookResult {
  seeded: boolean;
  playbook: RecoveryPlaybookWithPhases | null;
}

export interface RecoveryOutreachResult extends RecoveryCaseDetail {
  outreachText?: string;
  previewOnly?: boolean;
  conversationId?: string;
  messageId?: string;
  playbookPhaseId?: string;
  playbookPhaseSortOrder?: number;
}

export interface GenerateRecoveryPaymentLinkResult {
  caseId: string;
  status: RecoveryStatus;
  paymentReference: string;
  paymentLinkId: string;
  url: string;
  conversationId?: string;
  messageId?: string;
}

export interface SendRecoveryGuidanceResult extends RecoveryCaseDetail {
  conversationId?: string;
  messageId?: string;
  sentText?: string;
}

export interface GenerateRecoveryReportJobInput {
  branchId?: string | null;
  statuses?: RecoveryStatus[];
  sources?: RecoverySource[];
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

/** Resposta de `POST /tenants/:tenantId/recovery/reports` (relatório síncrono). */
export interface RecoverySyncReportSummary {
  totalCases?: number;
  totalOpenAmount?: number;
}

export interface RecoverySyncReportResponse {
  generatedAt: string;
  summary: RecoverySyncReportSummary;
  cases?: unknown[];
}

function asRecoveryJobsArray(
  response: RecoveryAsyncJob[] | { data?: RecoveryAsyncJob[] } | null | undefined,
): RecoveryAsyncJob[] {
  if (Array.isArray(response)) {
    return response;
  }
  if (Array.isArray(response?.data)) {
    return response.data;
  }
  return [];
}

function toOptionalIso(value?: string | null): string | undefined {
  return value ? new Date(value).toISOString() : undefined;
}

function toOptionalNumber(value?: string | number | null): number | undefined {
  if (value == null || value === '') {
    return undefined;
  }

  const numericValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numericValue) ? numericValue : undefined;
}

function mapRecoveryPlaybook(input: any): RecoveryPlaybookRecord {
  return {
    id: String(input.id),
    tenantId: String(input.tenantId ?? input.tenant_id),
    branchId: input.branchId != null ? String(input.branchId) : input.branch_id != null ? String(input.branch_id) : null,
    name: String(input.name),
    version: Number(input.version ?? 1),
    active: Boolean(input.active),
    isSystem: Boolean(input.isSystem ?? input.is_system ?? false),
    createdAt: new Date(input.createdAt ?? input.created_at).toISOString(),
    updatedAt: new Date(input.updatedAt ?? input.updated_at).toISOString(),
  };
}

function mapRecoveryPlaybookPhase(input: any): RecoveryPlaybookPhase {
  return {
    id: String(input.id),
    playbookId: String(input.playbookId ?? input.playbook_id),
    sortOrder: Number(input.sortOrder ?? input.sort_order ?? 0),
    channel: String(input.channel ?? 'WHATSAPP'),
    minDelayHoursSincePrevious: Number(
      input.minDelayHoursSincePrevious ?? input.min_delay_hours_since_previous ?? 0,
    ),
    minDaysOverdue: Number(input.minDaysOverdue ?? input.min_days_overdue ?? 0),
    mode: (input.mode ?? 'AI') as RecoveryPlaybookPhaseMode,
    templateBody:
      input.templateBody != null || input.template_body != null
        ? String(input.templateBody ?? input.template_body)
        : null,
  };
}

function mapRecoveryPlaybookWithPhases(input: any): RecoveryPlaybookWithPhases {
  const playbook =
    input.playbook != null ? mapRecoveryPlaybook(input.playbook) : mapRecoveryPlaybook(input);
  const phasesRaw = input.phases ?? [];
  const phases = Array.isArray(phasesRaw)
    ? phasesRaw.map(mapRecoveryPlaybookPhase)
    : [];
  return { playbook, phases };
}

function mapRecoveryCase(input: RecoveryCaseApiResponse): RecoveryCaseDetail {
  return {
    id: input.id,
    branchId: input.branchId ?? undefined,
    contactId: input.contactId ?? undefined,
    debtorName: input.debtorName,
    debtorCompanyName: input.debtorCompanyName ?? undefined,
    debtorDocument: input.debtorDocument ?? undefined,
    phone: input.phone,
    source: input.source,
    status: input.status,
    amountDue: toOptionalNumber(input.amountDue),
    dueDate: toOptionalIso(input.dueDate),
    externalReference: input.externalReference ?? undefined,
    paymentReference: input.paymentReference ?? undefined,
    chargeType: input.chargeType ?? undefined,
    chargeTitle: input.chargeTitle ?? undefined,
    chargeDescription: input.chargeDescription ?? undefined,
    referencePeriod: input.referencePeriod ?? undefined,
    relatedEntityType: input.relatedEntityType ?? undefined,
    relatedEntityId: input.relatedEntityId ?? undefined,
    relatedEntityLabel: input.relatedEntityLabel ?? undefined,
    assignedTags: input.assignedTags ?? [],
    lastContactedAt: toOptionalIso(input.lastContactedAt),
    nextActionAt: toOptionalIso(input.nextActionAt),
    paidAt: toOptionalIso(input.paidAt),
    suggestedReply: input.suggestedReply ?? undefined,
    suggestedNextAction: input.suggestedNextAction ?? undefined,
    guidanceGeneratedAt: toOptionalIso(input.guidanceGeneratedAt),
    playbookId: input.playbookId ?? (input as any).playbook_id ?? undefined,
    playbookPhaseIndex:
      input.playbookPhaseIndex ?? (input as any).playbook_phase_index ?? undefined,
    lastPlaybookPhaseExecutedAt: toOptionalIso(
      input.lastPlaybookPhaseExecutedAt ?? (input as any).last_playbook_phase_executed_at,
    ),
    createdAt: new Date(input.createdAt).toISOString(),
    updatedAt: new Date(input.updatedAt).toISOString(),
  };
}

function toOptionalIsoString(value?: string | Date | null): string | undefined {
  if (!value) {
    return undefined;
  }

  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }

  return value.toISOString();
}

function mapRecoveryRecurringCharge(input: any): RecoveryRecurringCharge {
  return {
    id: String(input.id),
    tenantId: String(input.tenantId ?? input.tenant_id),
    branchId: input.branchId ?? input.branch_id ?? null,
    caseId: String(input.caseId ?? input.case_id),
    status: input.status as RecoveryRecurringChargeStatus,
    billingType: (input.billingType ?? input.billing_type) as RecoveryBillingType,
    intervalDays: Number(input.intervalDays ?? input.interval_days),
    maxOccurrences:
      input.maxOccurrences ?? input.max_occurrences ?? null,
    occurrencesSent: Number(input.occurrencesSent ?? input.occurrences_sent ?? 0),
    firstRunAt: new Date(input.firstRunAt ?? input.first_run_at).toISOString(),
    nextRunAt: toOptionalIsoString(input.nextRunAt ?? input.next_run_at) ?? null,
    lastRunAt: toOptionalIsoString(input.lastRunAt ?? input.last_run_at) ?? null,
    messageTemplate: input.messageTemplate ?? input.message_template ?? null,
    lastError: input.lastError ?? input.last_error ?? null,
    createdByUserId: input.createdByUserId ?? input.created_by_user_id ?? null,
    createdByUserEmail: input.createdByUserEmail ?? input.created_by_user_email ?? null,
    cancelledAt: toOptionalIsoString(input.cancelledAt ?? input.cancelled_at) ?? null,
    completedAt: toOptionalIsoString(input.completedAt ?? input.completed_at) ?? null,
    createdAt: new Date(input.createdAt ?? input.created_at).toISOString(),
    updatedAt: new Date(input.updatedAt ?? input.updated_at).toISOString(),
  };
}

export const recoveryService = {
  async listCases(
    tenantId: string,
    filters?: {
      branchId?: string;
      status?: RecoveryStatus;
      source?: RecoverySource;
      dateFrom?: string;
      dateTo?: string;
    },
  ): Promise<RecoveryCaseDetail[]> {
    const response = await apiClient.get<RecoveryCaseApiResponse[]>(
      `/tenants/${tenantId}/recovery/cases`,
      {
        branchId: filters?.branchId,
        status: filters?.status,
        source: filters?.source,
        dateFrom: filters?.dateFrom,
        dateTo: filters?.dateTo,
      },
    );

    return response.map(mapRecoveryCase);
  },

  async getCase(tenantId: string, caseId: string): Promise<RecoveryCaseDetail> {
    const response = await apiClient.get<RecoveryCaseApiResponse>(
      `/tenants/${tenantId}/recovery/cases/${caseId}`,
    );

    return mapRecoveryCase(response);
  },

  async createCase(
    tenantId: string,
    input: CreateRecoveryCaseInput,
  ): Promise<RecoveryCaseDetail> {
    const response = await apiClient.post<RecoveryCaseApiResponse>(
      `/tenants/${tenantId}/recovery/cases`,
      input,
    );

    return mapRecoveryCase(response);
  },

  async triggerOutreach(
    tenantId: string,
    caseId: string,
    input: TriggerRecoveryOutreachInput,
  ): Promise<RecoveryOutreachResult> {
    const response = await apiClient.post<
      RecoveryCaseApiResponse & {
        outreachText?: string;
        previewOnly?: boolean;
        conversationId?: string;
        messageId?: string;
        playbookPhaseId?: string;
        playbookPhaseSortOrder?: number;
      }
    >(`/tenants/${tenantId}/recovery/cases/${caseId}/outreach`, input);

    return {
      ...mapRecoveryCase(response),
      outreachText: response.outreachText,
      previewOnly: response.previewOnly,
      conversationId: response.conversationId,
      messageId: response.messageId,
      playbookPhaseId: response.playbookPhaseId,
      playbookPhaseSortOrder: response.playbookPhaseSortOrder,
    };
  },

  async listPlaybooks(tenantId: string): Promise<RecoveryPlaybookWithPhases[]> {
    const raw = await apiClient.get<any[]>(`/tenants/${tenantId}/recovery/playbooks`);
    return raw.map(mapRecoveryPlaybookWithPhases);
  },

  async seedDefaultPlaybook(tenantId: string): Promise<SeedDefaultRecoveryPlaybookResult> {
    const raw = await apiClient.post<{
      seeded: boolean;
      playbook: unknown | null;
    }>(`/tenants/${tenantId}/recovery/playbooks/seed-default`);
    return {
      seeded: Boolean(raw.seeded),
      playbook: raw.playbook ? mapRecoveryPlaybookWithPhases(raw.playbook) : null,
    };
  },

  async createPlaybook(
    tenantId: string,
    input: CreateRecoveryPlaybookInput,
  ): Promise<RecoveryPlaybookWithPhases> {
    const raw = await apiClient.post<any>(
      `/tenants/${tenantId}/recovery/playbooks`,
      input,
    );
    return mapRecoveryPlaybookWithPhases(raw);
  },

  async activatePlaybook(tenantId: string, playbookId: string): Promise<RecoveryPlaybookRecord> {
    const raw = await apiClient.patch<any>(
      `/tenants/${tenantId}/recovery/playbooks/${playbookId}/activate`,
    );
    return mapRecoveryPlaybook(raw);
  },

  async regenerateGuidance(
    tenantId: string,
    caseId: string,
    customerMessage?: string,
  ): Promise<RecoveryCaseDetail> {
    const response = await apiClient.post<RecoveryCaseApiResponse>(
      `/tenants/${tenantId}/recovery/cases/${caseId}/guidance`,
      customerMessage ? { customerMessage } : {},
    );

    return mapRecoveryCase(response);
  },

  async sendGuidance(
    tenantId: string,
    caseId: string,
  ): Promise<SendRecoveryGuidanceResult> {
    const response = await apiClient.post<
      RecoveryCaseApiResponse & {
        conversationId?: string;
        messageId?: string;
        sentText?: string;
      }
    >(`/tenants/${tenantId}/recovery/cases/${caseId}/guidance/send`);

    return {
      ...mapRecoveryCase(response),
      conversationId: response.conversationId,
      messageId: response.messageId,
      sentText: response.sentText,
    };
  },

  async generatePaymentLink(
    tenantId: string,
    caseId: string,
    billingType: RecoveryBillingType,
  ): Promise<GenerateRecoveryPaymentLinkResult> {
    return apiClient.post<GenerateRecoveryPaymentLinkResult>(
      `/tenants/${tenantId}/recovery/cases/${caseId}/payment-link`,
      { billingType },
    );
  },

  async scheduleRecurringCharge(
    tenantId: string,
    caseId: string,
    input: {
      billingType?: RecoveryBillingType;
      intervalDays: number;
      maxOccurrences?: number;
      firstRunAt?: string;
      messageTemplate?: string;
    },
  ): Promise<RecoveryRecurringCharge> {
    const response = await apiClient.post<any>(
      `/tenants/${tenantId}/recovery/cases/${caseId}/recurring-charges`,
      input,
    );
    return mapRecoveryRecurringCharge(response);
  },

  async listRecurringCharges(
    tenantId: string,
    caseId: string,
  ): Promise<RecoveryRecurringCharge[]> {
    const response = await apiClient.get<any[]>(
      `/tenants/${tenantId}/recovery/cases/${caseId}/recurring-charges`,
    );
    return response.map(mapRecoveryRecurringCharge);
  },

  async cancelRecurringCharge(
    tenantId: string,
    recurrenceId: string,
    reason?: string,
  ): Promise<RecoveryRecurringCharge> {
    const response = await apiClient.patch<any>(
      `/tenants/${tenantId}/recovery/recurring-charges/${recurrenceId}/cancel`,
      reason ? { reason } : {},
    );
    return mapRecoveryRecurringCharge(response);
  },

  async updateCaseStatus(
    tenantId: string,
    caseId: string,
    input: {
      status: RecoveryStatus;
      nextActionAt?: string;
    },
  ): Promise<RecoveryCaseDetail> {
    const response = await apiClient.patch<RecoveryCaseApiResponse>(
      `/tenants/${tenantId}/recovery/cases/${caseId}/status`,
      input,
    );

    return mapRecoveryCase(response);
  },

  async startReportJob(
    tenantId: string,
    input: GenerateRecoveryReportJobInput,
  ): Promise<RecoveryAsyncJob> {
    return apiClient.post<RecoveryAsyncJob>(
      input.branchId
        ? `/tenants/${tenantId}/recovery/report-jobs?branchId=${encodeURIComponent(input.branchId)}`
        : `/tenants/${tenantId}/recovery/report-jobs`,
      {
        statuses: input.statuses,
        sources: input.sources,
        search: input.search?.trim() || undefined,
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
      },
    );
  },

  async generateReportSync(
    tenantId: string,
    input: GenerateRecoveryReportJobInput,
  ): Promise<RecoverySyncReportResponse> {
    const path = input.branchId
      ? `/tenants/${tenantId}/recovery/reports?branchId=${encodeURIComponent(input.branchId)}`
      : `/tenants/${tenantId}/recovery/reports`;

    return apiClient.post<RecoverySyncReportResponse>(path, {
      statuses: input.statuses,
      sources: input.sources,
      search: input.search?.trim() || undefined,
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
    });
  },

  async getAsyncJob(tenantId: string, jobId: string): Promise<RecoveryAsyncJob> {
    return apiClient.get<RecoveryAsyncJob>(`/tenants/${tenantId}/recovery/jobs/${jobId}`);
  },

  async listAsyncJobs(tenantId: string): Promise<RecoveryAsyncJob[]> {
    const response = await apiClient.get<
      RecoveryAsyncJob[] | { data?: RecoveryAsyncJob[] }
    >(`/tenants/${tenantId}/recovery/jobs`);

    return asRecoveryJobsArray(response);
  },

  async downloadAsyncJobFile(
    tenantId: string,
    jobId: string,
    fallbackFileName?: string,
  ): Promise<void> {
    const anchor = document.createElement('a');
    anchor.href = `${BASE_URL}/tenants/${tenantId}/recovery/jobs/${jobId}/download`;
    anchor.download = fallbackFileName ?? `cobranças-${jobId}.csv`;

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  },
};
