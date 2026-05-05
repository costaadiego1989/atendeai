export interface SchedulingGoogleCalendarEventLink {
  tenantId: string;
  branchId?: string | null;
  professionalId: string;
  date: string;
  slotId: string;
  eventId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ISchedulingGoogleCalendarEventLinkRepository {
  save(link: SchedulingGoogleCalendarEventLink): Promise<void>;
  findBySlot(input: {
    tenantId: string;
    professionalId: string;
    date: string;
    slotId: string;
  }): Promise<SchedulingGoogleCalendarEventLink | null>;
  reassignSlot(input: {
    tenantId: string;
    sourceProfessionalId: string;
    sourceDate: string;
    sourceSlotId: string;
    targetProfessionalId: string;
    targetDate: string;
    targetSlotId: string;
    branchId?: string | null;
    updatedAt: string;
  }): Promise<void>;
  deleteBySlot(input: {
    tenantId: string;
    professionalId: string;
    date: string;
    slotId: string;
  }): Promise<void>;
}

export const SCHEDULING_GOOGLE_CALENDAR_EVENT_LINK_REPOSITORY = Symbol(
  'SCHEDULING_GOOGLE_CALENDAR_EVENT_LINK_REPOSITORY',
);
