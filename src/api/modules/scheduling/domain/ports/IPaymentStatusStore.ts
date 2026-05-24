import {
  AvailabilitySlotRecord,
  MarkSlotPaymentConfirmedResult,
} from './ISchedulingStore';

export interface IPaymentStatusStore {
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
  markSlotPaymentConfirmedByReference(input: {
    tenantId: string;
    professionalId: string;
    date: string;
    slotId: string;
    paymentReference: string;
    confirmedAt: string;
  }): Promise<MarkSlotPaymentConfirmedResult>;
}

export const PAYMENT_STATUS_STORE = Symbol('PAYMENT_STATUS_STORE');
