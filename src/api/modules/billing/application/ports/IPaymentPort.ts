/**
 * Outbound port for payment operations needed by the billing module.
 * Billing uses this port to interact with the payment gateway
 * without directly importing payment module internals.
 */

export interface CreateCustomerInput {
  name: string;
  email: string;
  cpfCnpj: string;
  phone: string;
  externalReference: string;
}

export interface CreateSubscriptionInput {
  customer: string;
  billingType: 'PIX' | 'CREDIT_CARD' | 'BOLETO';
  value: number;
  nextDueDate: string;
  cycle: 'MONTHLY' | 'YEARLY';
  description?: string;
  externalReference?: string;
}

export interface UpdateSubscriptionInput {
  billingType?: 'PIX' | 'CREDIT_CARD' | 'BOLETO';
  value?: number;
  nextDueDate?: string;
  cycle?: 'MONTHLY' | 'YEARLY';
  description?: string;
  externalReference?: string;
  updatePendingPayments?: boolean;
}

export interface CreatePaymentLinkInput {
  name: string;
  description?: string;
  value: number;
  externalReference?: string;
  billingType: 'UNDEFINED' | 'BOLETO' | 'CREDIT_CARD' | 'PIX';
  chargeType: 'DETACHED' | 'RECURRENT';
  dueDateLimitDays?: number;
}

export interface IPaymentPort {
  createCustomer(input: CreateCustomerInput): Promise<{ customerId: string }>;

  createSubscription(
    input: CreateSubscriptionInput,
  ): Promise<{ subscriptionId: string }>;

  updateSubscription(
    subscriptionId: string,
    input: UpdateSubscriptionInput,
  ): Promise<void>;

  cancelSubscription(subscriptionId: string): Promise<void>;

  createPaymentLink(
    input: CreatePaymentLinkInput,
  ): Promise<{ url: string; id: string }>;
}

export const BILLING_PAYMENT_PORT = Symbol('BILLING_PAYMENT_PORT');
