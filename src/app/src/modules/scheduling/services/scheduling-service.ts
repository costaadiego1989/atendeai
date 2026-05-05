import { apiClient, BASE_URL } from '@/shared/api/client';
import type {
  AvailabilitySlot,
  CategoryAvailability,
  Professional,
  ScheduleCategory,
  SchedulingAsyncJob,
} from '@/shared/types';

interface CreateProfessionalInput {
  name: string;
  phone?: string;
  role?: string;
}

interface CreateCategoryInput {
  name: string;
  unit: 'PER_MINUTE' | 'PER_SESSION' | 'PER_CONSULTATION';
  durationMinutes?: number;
  basePrice?: number;
}

interface SaveAvailabilityInput {
  date: string;
  slots: Array<{
    startsAt: string;
    endsAt: string;
    label?: string;
    customPrice?: number;
    isOnline?: boolean;
  }>;
}

interface ReserveSlotInput {
  date: string;
  slotId: string;
  contactId?: string;
  categoryId?: string;
  conversationId?: string;
  notes?: string;
  isFree?: boolean;
  paymentTimeoutHours?: number;
  isOnline?: boolean;
}

export type SchedulingRecurrenceFrequency = 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';

export interface SchedulingRecurrence {
  id: string;
  tenantId: string;
  branchId?: string | null;
  professionalId: string;
  contactId?: string | null;
  categoryId?: string | null;
  period: SchedulingRecurrenceFrequency;
  interval: number;
  maxOccurrences: number;
  occurrencesCreated: number;
  startsAt: string;
  endsAt: string;
  firstDate: string;
  endDate?: string | null;
  nextDate?: string | null;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'FAILED';
  isFree?: boolean;
  isOnline?: boolean;
  notes?: string | null;
  lastError?: string | null;
  createdAt: string;
}

export interface CreateSchedulingRecurrenceInput {
  professionalId: string;
  contactId?: string;
  categoryId?: string;
  startDate: string;
  endDate?: string;
  maxOccurrences?: number;
  startsAt: string;
  endsAt: string;
  frequency: SchedulingRecurrenceFrequency;
  interval?: number;
  isFree?: boolean;
  isOnline?: boolean;
  paymentTimeoutHours?: number;
  notes?: string;
}

interface UpdateSlotInput {
  date: string;
  action:
    | 'BLOCK'
    | 'UNBLOCK'
    | 'CANCEL_RESERVATION'
    | 'UPDATE_RESERVATION'
    | 'MARK_COMPLETED'
    | 'MARK_NO_SHOW';
  contactId?: string;
  categoryId?: string;
  notes?: string;
}

interface RescheduleReservationInput {
  sourceDate: string;
  targetDate: string;
  targetSlotId: string;
}

export interface GenerateSchedulingReportJobInput {
  startDate: string;
  endDate: string;
  professionalIds?: string[];
  categoryIds?: string[];
  statuses?: Array<'AVAILABLE' | 'PRE_RESERVED' | 'RESERVED' | 'COMPLETED' | 'NO_SHOW' | 'BLOCKED'>;
  branchId?: string | null;
}

export type SchedulingSlotBillingType = 'UNDEFINED' | 'BOLETO' | 'CREDIT_CARD' | 'PIX';

export interface SchedulingSyncReportSummary {
  totalSlots?: number;
  reservedSlots?: number;
  blockedSlots?: number;
  availableSlots?: number;
  completedSlots?: number;
  noShowSlots?: number;
  estimatedRevenue?: number;
}

export interface SchedulingSyncReportResponse {
  generatedAt: string;
  summary: SchedulingSyncReportSummary;
  slots?: unknown[];
}

export interface SchedulingGoogleCalendarConnectionStatus {
  connected: boolean;
  status: 'CONNECTED' | 'NOT_CONNECTED';
  scope?: 'BRANCH' | 'TENANT' | 'NONE';
  googleEmail?: string;
  calendarId?: string;
  connectedAt?: string;
  updatedAt?: string;
}

export interface SchedulingGoogleCalendarItem {
  id: string;
  summary: string;
  primary?: boolean;
  selected?: boolean;
}

function withBranchQuery(path: string, branchId?: string | null) {
  if (!branchId) {
    return path;
  }

  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}branchId=${encodeURIComponent(branchId)}`;
}

function asArray<T>(value: T[] | { data?: T[]; items?: T[] } | null | undefined): T[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (Array.isArray(value?.data)) {
    return value.data;
  }

  if (Array.isArray(value?.items)) {
    return value.items;
  }

  return [];
}

function compactArray<T>(value: T[] | { data?: T[]; items?: T[] } | null | undefined): NonNullable<T>[] {
  return asArray(value).filter(Boolean) as NonNullable<T>[];
}

function mapProfessional(professional: {
  id: string;
  tenantId?: string;
  name: string;
  phone?: string | null;
  role?: string | null;
  active?: boolean;
  createdAt?: string;
}): Professional {
  return {
    id: professional.id,
    tenantId: professional.tenantId,
    name: professional.name,
    phone: professional.phone ?? undefined,
    role: professional.role ?? null,
    active: professional.active,
    createdAt: professional.createdAt,
  };
}

function mapCategory(category: {
  id: string;
  tenantId?: string;
  name: string;
  unit: 'PER_MINUTE' | 'PER_SESSION' | 'PER_CONSULTATION';
  durationMinutes?: number | null;
  basePrice?: number | null;
  active?: boolean;
  createdAt?: string;
}): ScheduleCategory {
  return {
    id: category.id,
    tenantId: category.tenantId,
    name: category.name,
    unit: category.unit,
    duration: category.durationMinutes ?? undefined,
    durationMinutes: category.durationMinutes,
    basePrice: category.basePrice ?? null,
    active: category.active,
    createdAt: category.createdAt,
  };
}

function mapSlot(
  slot: {
    id: string;
    startsAt: string;
    endsAt: string;
    label?: string | null;
    customPrice?: number | null;
    status: 'AVAILABLE' | 'PRE_RESERVED' | 'RESERVED' | 'COMPLETED' | 'NO_SHOW' | 'BLOCKED';
    reservedAt?: string;
    payment?: {
      reference: string;
      linkId: string;
      linkUrl: string;
      amount: number;
      billingType: 'UNDEFINED' | 'BOLETO' | 'CREDIT_CARD' | 'PIX';
      status: 'PENDING' | 'PAID';
      expiresAt?: string;
      confirmedAt?: string;
    };
    reservedFor?: {
      contactId?: string;
      contactName?: string;
      contactPhone?: string;
      contactEmail?: string;
      categoryId?: string;
      categoryName?: string;
      conversationId?: string;
      notes?: string;
      isOnline?: boolean;
      meetingProvider?: 'GOOGLE_MEET';
      meetingUrl?: string;
    };
    isOnline?: boolean;
  },
  professionalId: string,
  date: string,
): AvailabilitySlot {
  return {
    id: slot.id,
    professionalId,
    date,
    startTime: slot.startsAt,
    endTime: slot.endsAt,
    startsAt: slot.startsAt,
    endsAt: slot.endsAt,
    label: slot.label ?? null,
    customPrice: slot.customPrice ?? null,
    status: slot.status,
    isOnline: slot.isOnline,
    reserved: slot.status === 'RESERVED' || slot.status === 'PRE_RESERVED',
    reservedAt: slot.reservedAt,
    payment: slot.payment,
    reservedBy: slot.reservedFor?.notes,
    reservedFor: slot.reservedFor,
  };
}

export const schedulingService = {
  async getGoogleCalendarConnectionStatus(
    branchId?: string | null,
  ): Promise<SchedulingGoogleCalendarConnectionStatus> {
    return apiClient.get('/scheduling/google-calendar/connection/status', {
      branchId: branchId ?? undefined,
    });
  },

  async startGoogleCalendarConnection(
    branchId?: string | null,
  ): Promise<{ authorizationUrl: string }> {
    return apiClient.post(
      withBranchQuery('/scheduling/google-calendar/connection/start', branchId),
    );
  },

  async disconnectGoogleCalendarConnection(
    branchId?: string | null,
  ): Promise<{ disconnected: boolean }> {
    return apiClient.delete(
      withBranchQuery('/scheduling/google-calendar/connection', branchId),
    );
  },

  async listGoogleCalendars(
    branchId?: string | null,
  ): Promise<SchedulingGoogleCalendarItem[]> {
    const response = await apiClient.get<
      SchedulingGoogleCalendarItem[] | { data?: SchedulingGoogleCalendarItem[]; items?: SchedulingGoogleCalendarItem[] }
    >('/scheduling/google-calendar/connection/calendars', {
      branchId: branchId ?? undefined,
    });

    return asArray(response);
  },

  async selectGoogleCalendar(
    calendarId: string,
    branchId?: string | null,
  ): Promise<SchedulingGoogleCalendarConnectionStatus> {
    return apiClient.post(
      withBranchQuery(
        '/scheduling/google-calendar/connection/select-calendar',
        branchId,
      ),
      {
        calendarId,
      },
    );
  },

  async listProfessionals(tenantId: string): Promise<Professional[]> {
    return this.listProfessionalsByBranch(tenantId);
  },

  async listProfessionalsByBranch(
    tenantId: string,
    branchId?: string | null,
  ): Promise<Professional[]> {
    const response = await apiClient.get<
      Array<{
        id: string;
        tenantId: string;
        branchId?: string | null;
        name: string;
        phone?: string | null;
        role?: string | null;
        active: boolean;
        createdAt: string;
      }>
    >(`/tenants/${tenantId}/scheduling/professionals`, { branchId: branchId ?? undefined });

    return compactArray(response).map(mapProfessional);
  },

  async createProfessional(
    tenantId: string,
    input: CreateProfessionalInput,
    branchId?: string | null,
  ): Promise<Professional> {
    const response = await apiClient.post<{
      id: string;
      tenantId: string;
      branchId?: string | null;
      name: string;
      phone?: string | null;
      role?: string | null;
      active: boolean;
      createdAt: string;
    }>(withBranchQuery(`/tenants/${tenantId}/scheduling/professionals`, branchId), input);

    return mapProfessional(response);
  },

  async listCategories(tenantId: string): Promise<ScheduleCategory[]> {
    return this.listCategoriesByBranch(tenantId);
  },

  async listRecurrences(
    tenantId: string,
    professionalId?: string | null,
  ): Promise<SchedulingRecurrence[]> {
    const response = await apiClient.get<SchedulingRecurrence[]>(
      `/tenants/${tenantId}/scheduling/recurrences`,
      { professionalId: professionalId ?? undefined },
    );

    return compactArray(response);
  },

  async createRecurrence(
    tenantId: string,
    input: CreateSchedulingRecurrenceInput,
    branchId?: string | null,
  ): Promise<SchedulingRecurrence> {
    return apiClient.post<SchedulingRecurrence>(
      withBranchQuery(`/tenants/${tenantId}/scheduling/recurrences`, branchId),
      input,
    );
  },

  async cancelRecurrence(
    tenantId: string,
    recurrenceId: string,
  ): Promise<SchedulingRecurrence> {
    return apiClient.patch<SchedulingRecurrence>(
      `/tenants/${tenantId}/scheduling/recurrences/${recurrenceId}/cancel`,
      { reason: 'cancelled_from_ui' },
    );
  },

  async deleteRecurrence(
    tenantId: string,
    recurrenceId: string,
  ): Promise<void> {
    await apiClient.delete(
      `/tenants/${tenantId}/scheduling/recurrences/${recurrenceId}`,
    );
  },

  async listCategoriesByBranch(
    tenantId: string,
    branchId?: string | null,
  ): Promise<ScheduleCategory[]> {
    const response = await apiClient.get<
      Array<{
        id: string;
        tenantId: string;
        branchId?: string | null;
        name: string;
        unit: 'PER_MINUTE' | 'PER_SESSION' | 'PER_CONSULTATION';
        durationMinutes?: number | null;
        basePrice?: number | null;
        active: boolean;
        createdAt: string;
      }>
    >(`/tenants/${tenantId}/scheduling/categories`, { branchId: branchId ?? undefined });

    return compactArray(response).map(mapCategory);
  },

  async createCategory(
    tenantId: string,
    input: CreateCategoryInput,
    branchId?: string | null,
  ): Promise<ScheduleCategory> {
    const response = await apiClient.post<{
      id: string;
      tenantId: string;
      branchId?: string | null;
      name: string;
      unit: 'PER_MINUTE' | 'PER_SESSION' | 'PER_CONSULTATION';
      durationMinutes?: number | null;
      basePrice?: number | null;
      active: boolean;
      createdAt: string;
    }>(withBranchQuery(`/tenants/${tenantId}/scheduling/categories`, branchId), input);

    return mapCategory(response);
  },

  async assignProfessionalCategories(
    tenantId: string,
    professionalId: string,
    categoryIds: string[],
  ): Promise<string[]> {
    return apiClient.post(
      `/tenants/${tenantId}/scheduling/professionals/${professionalId}/categories`,
      { categoryIds },
    );
  },

  async listCategoryProfessionals(
    tenantId: string,
    categoryId: string,
    branchId?: string | null,
  ): Promise<Professional[]> {
    const response = await apiClient.get<
      Array<{
        id: string;
        tenantId: string;
        branchId?: string | null;
        name: string;
        phone?: string | null;
        role?: string | null;
        active: boolean;
        createdAt: string;
      }>
    >(`/tenants/${tenantId}/scheduling/categories/${categoryId}/professionals`, {
      branchId: branchId ?? undefined,
    });

    return compactArray(response).map(mapProfessional);
  },

  async saveAvailability(
    tenantId: string,
    professionalId: string,
    input: SaveAvailabilityInput,
  ): Promise<AvailabilitySlot[]> {
    const response = await apiClient.post<
      Array<{
        id: string;
        startsAt: string;
        endsAt: string;
        label?: string | null;
        customPrice?: number | null;
        status: 'AVAILABLE' | 'RESERVED' | 'COMPLETED' | 'NO_SHOW' | 'BLOCKED';
        reservedAt?: string;
        reservedFor?: {
          contactId?: string;
          contactName?: string;
          contactPhone?: string;
          contactEmail?: string;
          categoryId?: string;
          categoryName?: string;
          conversationId?: string;
          notes?: string;
        };
      }>
    >(
      `/tenants/${tenantId}/scheduling/professionals/${professionalId}/availability`,
      input,
    );

    return compactArray(response).map((slot) => mapSlot(slot, professionalId, input.date));
  },

  async getAvailability(
    tenantId: string,
    professionalId: string,
    date: string,
  ): Promise<AvailabilitySlot[]> {
    const response = await apiClient.get<
      Array<{
        id: string;
        startsAt: string;
        endsAt: string;
        label?: string | null;
        customPrice?: number | null;
        status: 'AVAILABLE' | 'RESERVED' | 'COMPLETED' | 'NO_SHOW' | 'BLOCKED';
        reservedAt?: string;
        reservedFor?: {
          contactId?: string;
          contactName?: string;
          contactPhone?: string;
          contactEmail?: string;
          categoryId?: string;
          categoryName?: string;
          conversationId?: string;
          notes?: string;
        };
      }>
    >(`/tenants/${tenantId}/scheduling/professionals/${professionalId}/availability`, {
      date,
    });

    return compactArray(response).map((slot) => mapSlot(slot, professionalId, date));
  },

  async getCategoryAvailability(
    tenantId: string,
    categoryId: string,
    date: string,
    branchId?: string | null,
  ): Promise<CategoryAvailability[]> {
    const response = await apiClient.get<
      Array<{
        professionalId: string;
        professionalName: string;
        slots: Array<{
          id: string;
          startsAt: string;
          endsAt: string;
          label?: string | null;
          customPrice?: number | null;
          status: 'AVAILABLE' | 'RESERVED' | 'COMPLETED' | 'NO_SHOW' | 'BLOCKED';
          reservedAt?: string;
          reservedFor?: {
            contactId?: string;
            contactName?: string;
            contactPhone?: string;
            contactEmail?: string;
            categoryId?: string;
            categoryName?: string;
            conversationId?: string;
            notes?: string;
          };
        }>;
      }>
    >(`/tenants/${tenantId}/scheduling/categories/${categoryId}/availability`, {
      date,
      branchId: branchId ?? undefined,
    });

    return compactArray(response).map((entry) => ({
      professionalId: entry.professionalId,
      professionalName: entry.professionalName,
      slots: compactArray(entry.slots).map((slot) =>
        mapSlot(slot, entry.professionalId, date),
      ),
    }));
  },

  async reserveSlot(
    tenantId: string,
    professionalId: string,
    input: ReserveSlotInput,
    branchId?: string | null,
  ): Promise<AvailabilitySlot> {
    const response = await apiClient.post<{
      id: string;
      startsAt: string;
      endsAt: string;
      label?: string | null;
      customPrice?: number | null;
      status: 'AVAILABLE' | 'RESERVED' | 'COMPLETED' | 'NO_SHOW' | 'BLOCKED';
      reservedAt?: string;
      reservedFor?: {
        contactId?: string;
        contactName?: string;
        contactPhone?: string;
        contactEmail?: string;
        categoryId?: string;
        categoryName?: string;
        conversationId?: string;
        notes?: string;
      };
    }>(
      withBranchQuery(
        `/tenants/${tenantId}/scheduling/professionals/${professionalId}/availability/reservations`,
        branchId,
      ),
      input,
    );

    return mapSlot(response, professionalId, input.date);
  },

  async updateSlot(
    tenantId: string,
    professionalId: string,
    slotId: string,
    input: UpdateSlotInput,
    branchId?: string | null,
  ): Promise<AvailabilitySlot> {
    const response = await apiClient.patch<{
      id: string;
      startsAt: string;
      endsAt: string;
      label?: string | null;
      customPrice?: number | null;
      status: 'AVAILABLE' | 'RESERVED' | 'COMPLETED' | 'NO_SHOW' | 'BLOCKED';
      reservedAt?: string;
      reservedFor?: {
        contactId?: string;
        contactName?: string;
        contactPhone?: string;
        contactEmail?: string;
        categoryId?: string;
        categoryName?: string;
        conversationId?: string;
        notes?: string;
      };
    }>(
      withBranchQuery(
        `/tenants/${tenantId}/scheduling/professionals/${professionalId}/availability/slots/${slotId}`,
        branchId,
      ),
      input,
    );

    return mapSlot(response, professionalId, input.date);
  },

  async rescheduleReservation(
    tenantId: string,
    professionalId: string,
    slotId: string,
    input: RescheduleReservationInput,
    branchId?: string | null,
  ): Promise<AvailabilitySlot> {
    const response = await apiClient.post<{
      id: string;
      startsAt: string;
      endsAt: string;
      label?: string | null;
      customPrice?: number | null;
      status: 'AVAILABLE' | 'PRE_RESERVED' | 'RESERVED' | 'BLOCKED';
      reservedAt?: string;
      payment?: {
        reference: string;
        linkId: string;
        linkUrl: string;
        amount: number;
        billingType: 'UNDEFINED' | 'BOLETO' | 'CREDIT_CARD' | 'PIX';
        status: 'PENDING' | 'PAID';
        expiresAt?: string;
        confirmedAt?: string;
      };
      reservedFor?: {
        contactId?: string;
        contactName?: string;
        contactPhone?: string;
        contactEmail?: string;
        categoryId?: string;
        categoryName?: string;
        conversationId?: string;
        notes?: string;
      };
    }>(
      withBranchQuery(
        `/tenants/${tenantId}/scheduling/professionals/${professionalId}/availability/slots/${slotId}/reschedule`,
        branchId,
      ),
      input,
    );

    return mapSlot(response, professionalId, input.targetDate);
  },

  async startReportJob(
    tenantId: string,
    input: GenerateSchedulingReportJobInput,
  ): Promise<SchedulingAsyncJob> {
    return apiClient.post<SchedulingAsyncJob>(
      input.branchId
        ? `/tenants/${tenantId}/scheduling/report-jobs?branchId=${encodeURIComponent(input.branchId)}`
        : `/tenants/${tenantId}/scheduling/report-jobs`,
      {
        startDate: input.startDate,
        endDate: input.endDate,
        professionalIds: input.professionalIds,
        categoryIds: input.categoryIds,
        statuses: input.statuses,
      },
    );
  },

  async generateReportSync(
    tenantId: string,
    input: GenerateSchedulingReportJobInput,
  ): Promise<SchedulingSyncReportResponse> {
    const path = withBranchQuery(`/tenants/${tenantId}/scheduling/reports`, input.branchId);

    return apiClient.post<SchedulingSyncReportResponse>(path, {
      startDate: input.startDate,
      endDate: input.endDate,
      professionalIds: input.professionalIds,
      categoryIds: input.categoryIds,
      statuses: input.statuses,
    });
  },

  async getAsyncJob(tenantId: string, jobId: string): Promise<SchedulingAsyncJob> {
    return apiClient.get<SchedulingAsyncJob>(`/tenants/${tenantId}/scheduling/jobs/${jobId}`);
  },

  async listAsyncJobs(tenantId: string): Promise<SchedulingAsyncJob[]> {
    const response = await apiClient.get<
      SchedulingAsyncJob[] | { data?: SchedulingAsyncJob[] }
    >(`/tenants/${tenantId}/scheduling/jobs`);

    return compactArray(response);
  },

  async createSlotPaymentLink(
    tenantId: string,
    professionalId: string,
    slotId: string,
    date: string,
    billingType: SchedulingSlotBillingType,
    branchId?: string | null,
  ): Promise<AvailabilitySlot> {
    const response = await apiClient.post<{
      id: string;
      startsAt: string;
      endsAt: string;
      label?: string | null;
      customPrice?: number | null;
      status: 'AVAILABLE' | 'PRE_RESERVED' | 'RESERVED' | 'COMPLETED' | 'NO_SHOW' | 'BLOCKED';
      reservedAt?: string;
      payment?: {
        reference: string;
        linkId: string;
        linkUrl: string;
        amount: number;
        billingType: SchedulingSlotBillingType;
        status: 'PENDING' | 'PAID';
        expiresAt?: string;
        confirmedAt?: string;
      };
      reservedFor?: {
        contactId?: string;
        contactName?: string;
        contactPhone?: string;
        contactEmail?: string;
        categoryId?: string;
        categoryName?: string;
        conversationId?: string;
        notes?: string;
      };
    }>(
      withBranchQuery(
        `/tenants/${tenantId}/scheduling/professionals/${professionalId}/availability/slots/${slotId}/payment-link`,
        branchId,
      ),
      { billingType },
    );

    return mapSlot(response, professionalId, date);
  },

  async downloadAsyncJobFile(
    tenantId: string,
    jobId: string,
    fallbackFileName?: string,
  ): Promise<void> {
    const anchor = document.createElement('a');
    anchor.href = `${BASE_URL}/tenants/${tenantId}/scheduling/jobs/${jobId}/download`;
    anchor.download = fallbackFileName ?? `agenda-${jobId}.csv`;

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  },
};
