export type SchedulingCategoryUnit =
  | 'PER_MINUTE'
  | 'PER_SESSION'
  | 'PER_CONSULTATION';

export type SchedulingProfessionalRecord = {
  id: string;
  tenantId: string;
  branchId?: string | null;
  name: string;
  phone?: string | null;
  role?: string | null;
  active: boolean;
  createdAt: string;
};

export type AvailabilitySlotRecord = {
  id: string;
  startsAt: string;
  endsAt: string;
  label?: string | null;
  customPrice?: number | null;
  isOnline?: boolean;
  status:
    | 'AVAILABLE'
    | 'PRE_RESERVED'
    | 'RESERVED'
    | 'COMPLETED'
    | 'NO_SHOW'
    | 'BLOCKED';
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
};

export interface MarkSlotPaymentConfirmedResult {
  slot: AvailabilitySlotRecord | null;
  appliedChange: boolean;
}

export type SchedulingCategoryRecord = {
  id: string;
  tenantId: string;
  branchId?: string | null;
  name: string;
  unit: SchedulingCategoryUnit;
  durationMinutes?: number | null;
  basePrice?: number | null;
  active: boolean;
  createdAt: string;
};

export type CategoryAvailabilityRecord = {
  professionalId: string;
  professionalName: string;
  slots: AvailabilitySlotRecord[];
};

export interface ReserveAvailabilitySlotInput {
  tenantId: string;
  branchId?: string | null;
  professionalId: string;
  date: string;
  slotId: string;
  status?: 'PRE_RESERVED' | 'RESERVED';
  contactId?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  categoryId?: string;
  categoryName?: string;
  conversationId?: string;
  notes?: string;
  isOnline?: boolean;
}

export interface UpdateAvailabilitySlotInput {
  tenantId: string;
  branchId?: string | null;
  professionalId: string;
  date: string;
  slotId: string;
  action:
    | 'BLOCK'
    | 'UNBLOCK'
    | 'CANCEL_RESERVATION'
    | 'UPDATE_RESERVATION'
    | 'MARK_COMPLETED'
    | 'MARK_NO_SHOW';
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
}

export interface ISchedulingStore {
  createProfessional(input: {
    tenantId: string;
    branchId?: string | null;
    name: string;
    phone?: string;
    role?: string;
  }): Promise<SchedulingProfessionalRecord>;
  listProfessionals(
    tenantId: string,
    branchId?: string | null,
  ): Promise<SchedulingProfessionalRecord[]>;
  createCategory(input: {
    tenantId: string;
    branchId?: string | null;
    name: string;
    unit: SchedulingCategoryUnit;
    durationMinutes?: number;
    basePrice?: number;
  }): Promise<SchedulingCategoryRecord>;
  listCategories(
    tenantId: string,
    branchId?: string | null,
  ): Promise<SchedulingCategoryRecord[]>;
  assignCategoriesToProfessional(input: {
    tenantId: string;
    professionalId: string;
    categoryIds: string[];
  }): Promise<string[]>;
  listProfessionalsByCategory(
    tenantId: string,
    categoryId: string,
    branchId?: string | null,
  ): Promise<SchedulingProfessionalRecord[]>;
  saveAvailability(input: {
    tenantId: string;
    professionalId: string;
    date: string;
    slots: Array<{
      startsAt: string;
      endsAt: string;
      label?: string;
      customPrice?: number;
      isOnline?: boolean;
    }>;
  }): Promise<AvailabilitySlotRecord[]>;
  listAvailability(
    tenantId: string,
    professionalId: string,
    date: string,
  ): Promise<AvailabilitySlotRecord[]>;
  getAvailabilitySlot(
    tenantId: string,
    professionalId: string,
    date: string,
    slotId: string,
  ): Promise<AvailabilitySlotRecord | null>;
  listAvailabilityByCategory(
    tenantId: string,
    categoryId: string,
    date: string,
    branchId?: string | null,
  ): Promise<CategoryAvailabilityRecord[]>;
  reserveSlot(
    input: ReserveAvailabilitySlotInput,
  ): Promise<AvailabilitySlotRecord | null>;
  updateSlot(
    input: UpdateAvailabilitySlotInput,
  ): Promise<AvailabilitySlotRecord | null>;
  rescheduleReservation(input: {
    tenantId: string;
    professionalId: string;
    sourceDate: string;
    sourceSlotId: string;
    targetDate: string;
    targetSlotId: string;
  }): Promise<{
    sourceSlot: AvailabilitySlotRecord;
    targetSlot: AvailabilitySlotRecord;
  } | null>;
  attachPaymentLinkToReservedSlot(input: {
    tenantId: string;
    professionalId: string;
    date: string;
    slotId: string;
    reference: string;
    linkId: string;
    linkUrl: string;
    amount: number;
    billingType: 'UNDEFINED' | 'BOLETO' | 'CREDIT_CARD' | 'PIX';
    expiresAt?: string;
  }): Promise<AvailabilitySlotRecord | null>;
  markSlotPaymentConfirmedByReference(
    tenantId: string,
    paymentReference: string,
    confirmedAt: string,
  ): Promise<MarkSlotPaymentConfirmedResult>;
  attachMeetingLinkToReservedSlot(input: {
    tenantId: string;
    professionalId: string;
    date: string;
    slotId: string;
    meetingProvider: 'GOOGLE_MEET';
    meetingUrl: string;
  }): Promise<AvailabilitySlotRecord | null>;
}

export const SCHEDULING_STORE = Symbol('SCHEDULING_STORE');
