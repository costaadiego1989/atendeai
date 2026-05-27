export const PAYMENT_FACADE = 'PAYMENT_FACADE';

// --- Payment Link ---

export interface CreatePaymentLinkInput {
  name: string;
  description?: string;
  value: number;
  externalReference?: string;
  billingType: 'PIX' | 'BOLETO' | 'CREDIT_CARD' | 'UNDEFINED';
  chargeType: 'DETACHED' | 'RECURRENT' | 'INSTALLMENT';
  dueDateLimitDays?: number;
  maxInstallmentCount?: number;
}

export interface PaymentLinkOutput {
  id: string;
  url: string;
}

export interface PaymentLinkStatusOutput {
  id: string;
  status: string;
}

// --- Payment (Charge) ---

export interface PaymentSplitInput {
  walletId: string;
  fixedValue?: number;
  percentualValue?: number;
}

export interface CreatePaymentInput {
  customer: string;
  billingType: 'PIX' | 'CREDIT_CARD' | 'BOLETO';
  value: number;
  dueDate: string;
  description?: string;
  externalReference?: string;
  callback?: {
    successUrl: string;
    autoRedirect?: boolean;
  };
  split?: PaymentSplitInput[];
}

export interface PaymentOutput {
  id: string;
  status: string;
  value: number;
  billingType: string;
  dueDate: string;
  invoiceUrl: string;
  externalReference?: string;
}

// --- Customer ---

export interface CreateCustomerInput {
  name: string;
  cpfCnpj?: string;
  email?: string;
  phone?: string;
  mobilePhone?: string;
  externalReference?: string;
}

export interface CustomerOutput {
  id: string;
  name: string;
  cpfCnpj?: string;
  email?: string;
}

// --- Subscription ---

export interface CreateSubscriptionInput {
  customer: string;
  billingType: 'PIX' | 'CREDIT_CARD' | 'BOLETO';
  value: number;
  nextDueDate: string;
  cycle: 'MONTHLY' | 'YEARLY';
  description?: string;
  externalReference?: string;
  trialDays?: number;
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

export interface SubscriptionOutput {
  id: string;
  status: string;
  value: number;
  billingType: string;
  nextDueDate: string;
  invoiceUrl?: string;
}

// --- Subaccount ---

export interface CreateSubaccountInput {
  name: string;
  email: string;
  cpfCnpj: string;
  incomeValue: number;
  phone: string;
  mobilePhone: string;
  personType: 'LEGAL' | 'NATURAL';
  companyType: string;
  postalCode: string;
  address: string;
  addressNumber: string;
  province: string;
  city?: string;
  state?: string;
  complement?: string;
  birthDate?: string | null;
}

export interface SubaccountOutput {
  id: string;
  walletId: string;
  email?: string;
  cpfCnpj?: string;
  status?: string;
}

// --- Facade Interface ---

export interface IPaymentFacade {
  // Payment Links
  createPaymentLink(data: CreatePaymentLinkInput): Promise<PaymentLinkOutput>;
  removePaymentLink(paymentLinkId: string): Promise<PaymentLinkStatusOutput>;
  restorePaymentLink(paymentLinkId: string): Promise<PaymentLinkStatusOutput>;

  // Payments (Charges)
  createPayment(data: CreatePaymentInput): Promise<PaymentOutput>;
  deletePayment(paymentId: string): Promise<PaymentLinkStatusOutput>;
  restorePayment(paymentId: string): Promise<PaymentLinkStatusOutput>;

  // Customers
  createCustomer(data: CreateCustomerInput): Promise<CustomerOutput>;
  getCustomer(id: string): Promise<CustomerOutput>;

  // Subscriptions
  createSubscription(
    data: CreateSubscriptionInput,
  ): Promise<SubscriptionOutput>;
  updateSubscription(
    id: string,
    data: UpdateSubscriptionInput,
  ): Promise<SubscriptionOutput>;
  cancelSubscription(id: string): Promise<SubscriptionOutput>;
  getSubscription(id: string): Promise<SubscriptionOutput>;

  // Subaccounts
  createSubaccount(data: CreateSubaccountInput): Promise<SubaccountOutput>;
  listSubaccounts(): Promise<SubaccountOutput[]>;
}
