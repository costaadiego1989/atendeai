export interface ContactTimelineEntry {
  timestamp: Date;
  type:
    | 'CONTACT_CREATED'
    | 'CONTACT_STAGE'
    | 'CONTACT_NOTE'
    | 'RECOVERY_CASE_CREATED'
    | 'RECOVERY_STATUS'
    | 'CONVERSATION_STARTED'
    | 'MESSAGE_INBOUND'
    | 'MESSAGE_OUTBOUND'
    | 'PAYMENT_CONFIRMED'
    | 'PAYMENT_OVERDUE'
    | 'PAYMENT_REFUNDED'
    | 'SCHEDULING_RESERVED'
    | 'FOLLOW_UP_SCHEDULED'
    | 'FOLLOW_UP_CANCELLED'
    | 'FOLLOW_UP_TRIGGERED'
    | 'FOLLOW_UP_SKIPPED'
    | 'HANDOFF_HUMAN';
  title: string;
  details: Record<string, unknown>;
}

export interface ContactTimelineResult {
  contact: {
    id: string;
    name: string;
    phone: string;
    stage: string;
  };
  entries: ContactTimelineEntry[];
}

export interface IContactTimelineRepository {
  getTimeline(
    tenantId: string,
    contactId: string,
  ): Promise<ContactTimelineResult | null>;
}

export const CONTACT_TIMELINE_REPOSITORY = Symbol(
  'CONTACT_TIMELINE_REPOSITORY',
);
