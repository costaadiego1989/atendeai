import type { IAvailabilityStore } from './IAvailabilityStore';
import type { IReservationStore } from './IReservationStore';
import type { IPaymentStatusStore } from './IPaymentStatusStore';

export type { IAvailabilityStore, IReservationStore, IPaymentStatusStore };

import type {
  SchedulingBillingType,
  SchedulingMeetingProvider,
  SchedulingPaymentStatus,
  SchedulingSlotAction,
  SchedulingSlotStatus,
} from '../types/SchedulingEnums';

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
  status: SchedulingSlotStatus;
  reservedAt?: string;
  payment?: {
    reference: string;
    linkId: string;
    linkUrl: string;
    amount: number;
    billingType: SchedulingBillingType;
    status: SchedulingPaymentStatus;
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
    meetingProvider?: SchedulingMeetingProvider;
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
  status?: Extract<SchedulingSlotStatus, 'PRE_RESERVED' | 'RESERVED'>;
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
  action: SchedulingSlotAction;
  contactId?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  categoryId?: string;
  categoryName?: string;
  conversationId?: string;
  notes?: string;
  isOnline?: boolean;
  meetingProvider?: SchedulingMeetingProvider;
  meetingUrl?: string;
}

/**
 * Aggregate port kept as a backward-compatible alias (SCHEDULING_STORE).
 * Per ADR D-07 the surface is split into IAvailabilityStore,
 * IReservationStore and IPaymentStatusStore; consumers should migrate to the
 * narrow port slice they use. RedisSchedulingStore implements all three.
 */
export type ISchedulingStore = IAvailabilityStore &
  IReservationStore &
  IPaymentStatusStore;

export const SCHEDULING_STORE = Symbol('SCHEDULING_STORE');
