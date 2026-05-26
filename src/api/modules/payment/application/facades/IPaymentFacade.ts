export const PAYMENT_FACADE = 'PAYMENT_FACADE';

export interface CreatePaymentLinkInput {
  name: string;
  description: string;
  value: number;
  externalReference: string;
  billingType: 'PIX' | 'BOLETO' | 'CREDIT_CARD' | 'UNDEFINED';
  chargeType: 'DETACHED' | 'RECURRENT' | 'INSTALLMENT';
  dueDateLimitDays: number;
}

export interface PaymentLinkOutput {
  id: string;
  url: string;
}

export interface IPaymentFacade {
  createPaymentLink(data: CreatePaymentLinkInput): Promise<PaymentLinkOutput>;
  removePaymentLink(paymentLinkId: string): Promise<void>;
}
