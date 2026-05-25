import {
  AvailabilitySlotRecord,
  ReserveAvailabilitySlotInput,
  UpdateAvailabilitySlotInput,
} from './ISchedulingStore';
import type { SchedulingMeetingProvider } from '../types/SchedulingEnums';

export interface IReservationStore {
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
  attachMeetingLinkToReservedSlot(input: {
    tenantId: string;
    professionalId: string;
    date: string;
    slotId: string;
    meetingProvider: SchedulingMeetingProvider;
    meetingUrl: string;
  }): Promise<AvailabilitySlotRecord | null>;
}

export const RESERVATION_STORE = Symbol('RESERVATION_STORE');
