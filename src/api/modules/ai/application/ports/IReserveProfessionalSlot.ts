/**
 * Port interface for professional slot reservation.
 * Used by the AI module to reserve scheduling slots
 * without depending on the concrete Scheduling use case.
 */
export interface IReserveProfessionalSlot {
  execute(input: ReserveProfessionalSlotInput): Promise<ReserveProfessionalSlotOutput>;
}

export interface ReserveProfessionalSlotInput {
  tenantId: string;
  branchId?: string | null;
  professionalId: string;
  date: string;
  slotId: string;
  categoryId?: string;
  contactId: string;
  conversationId: string;
  isFree: boolean;
  paymentTimeoutHours?: number;
  suppressCustomerNotification?: boolean;
}

export interface ReserveProfessionalSlotOutput {
  startsAt: string;
  endsAt: string;
  label?: string | null;
  status?: string;
  reservedFor?: {
    contactId?: string;
    contactName?: string;
    categoryName?: string | null;
    meetingUrl?: string | null;
  };
  payment?: {
    linkUrl?: string;
    linkId?: string;
    status?: string;
  } | null;
}

export const RESERVE_PROFESSIONAL_SLOT = Symbol('RESERVE_PROFESSIONAL_SLOT');
