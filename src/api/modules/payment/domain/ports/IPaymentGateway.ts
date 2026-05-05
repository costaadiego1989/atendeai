export interface CreateCustomerData {
    name: string;
    cpfCnpj?: string;
    email?: string;
    phone?: string;
    mobilePhone?: string;
    externalReference?: string;
}

export interface CustomerResult {
    id: string;
    name: string;
    cpfCnpj?: string;
    email?: string;
    phone?: string;
    mobilePhone?: string;
}

export interface CreateSubaccountData {
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

export interface SubaccountResult {
    id: string;
    walletId: string;
    email?: string;
    cpfCnpj?: string;
    status?: string;
}

export interface CreateSubscriptionData {
    customer: string;
    billingType: 'PIX' | 'CREDIT_CARD' | 'BOLETO';
    value: number;
    nextDueDate: string;
    cycle: 'MONTHLY' | 'YEARLY';
    description?: string;
    externalReference?: string;
    trialDays?: number;
}

export interface UpdateSubscriptionData {
    billingType?: 'PIX' | 'CREDIT_CARD' | 'BOLETO';
    value?: number;
    nextDueDate?: string;
    cycle?: 'MONTHLY' | 'YEARLY';
    description?: string;
    externalReference?: string;
    updatePendingPayments?: boolean;
}

export interface SubscriptionResult {
    id: string;
    status: string;
    value: number;
    billingType: string;
    nextDueDate: string;
    invoiceUrl?: string;
}

export interface CreatePaymentLinkData {
    name: string;
    description?: string;
    value: number;
    externalReference?: string;
    billingType: 'UNDEFINED' | 'BOLETO' | 'CREDIT_CARD' | 'PIX';
    chargeType: 'DETACHED' | 'RECURRENT';
    dueDateLimitDays?: number;
    maxInstallmentCount?: number;
}

export interface PaymentLinkResult {
    id: string;
    url: string;
}

export interface PaymentLinkStatusResult {
    id: string;
    status: string;
}

export interface PaymentSplitData {
    walletId: string;
    fixedValue?: number;
    percentualValue?: number;
}

export interface CreatePaymentData {
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
    split?: PaymentSplitData[];
}

export interface PaymentResult {
    id: string;
    status: string;
    value: number;
    billingType: string;
    dueDate: string;
    invoiceUrl: string;
    externalReference?: string;
}

export type WebhookEventType =
    | 'PAYMENT_RECEIVED'
    | 'PAYMENT_CONFIRMED'
    | 'PAYMENT_OVERDUE'
    | 'PAYMENT_REFUNDED'
    | 'SUBSCRIPTION_DELETED'
    | 'UNKNOWN';

export interface ParsedWebhookEvent {
    provider: 'ASAAS' | 'MERCADOPAGO' | 'STRIPE' | string;
    eventType: WebhookEventType;
    paymentId: string;
    tenantId?: string;
    amount?: number;
    occurredAt?: Date;
    rawReference?: string;
    rawPayload: any;
}

export interface IPaymentGateway {
    createCustomer(data: CreateCustomerData): Promise<CustomerResult>;
    createSubaccount(data: CreateSubaccountData): Promise<SubaccountResult>;
    listSubaccounts(): Promise<SubaccountResult[]>;
    createSubscription(data: CreateSubscriptionData): Promise<SubscriptionResult>;
    updateSubscription(
        subscriptionId: string,
        data: UpdateSubscriptionData,
    ): Promise<SubscriptionResult>;
    cancelSubscription(subscriptionId: string): Promise<SubscriptionResult>;
    getSubscription(subscriptionId: string): Promise<SubscriptionResult>;
    createPayment(data: CreatePaymentData): Promise<PaymentResult>;
    deletePayment(paymentId: string): Promise<PaymentLinkStatusResult>;
    restorePayment(paymentId: string): Promise<PaymentLinkStatusResult>;
    createPaymentLink(data: CreatePaymentLinkData): Promise<PaymentLinkResult>;
    removePaymentLink(paymentLinkId: string): Promise<PaymentLinkStatusResult>;
    restorePaymentLink(paymentLinkId: string): Promise<PaymentLinkStatusResult>;
    parseWebhook(payload: any, signature?: string): ParsedWebhookEvent | null;
    getCustomer(id: string): Promise<CustomerResult>;
}

export const IPAYMENT_GATEWAY = Symbol('IPAYMENT_GATEWAY');
