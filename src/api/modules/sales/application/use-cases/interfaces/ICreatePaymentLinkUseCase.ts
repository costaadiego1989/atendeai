export interface CreatePaymentLinkInput {
  tenantId: string;
  branchId?: string | null;
  name: string;
  description?: string;
  label?: string;
  value: number;
  billingType: 'PIX' | 'CREDIT_CARD' | 'BOLETO' | 'UNDEFINED';
  expiresAt?: Date;
  source?: 'MANUAL' | 'AI';
  catalogItemId?: string | null;
  catalogItemSku?: string | null;
  catalogItemName?: string | null;
  recurrence?: {
    frequency?: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
    startDate?: Date;
    endDate?: Date;
  };
}

export interface CreatePaymentLinkOutput {
  id: string;
  url: string;
  name: string;
  description?: string;
  label?: string;
  value: number;
  billingType: 'PIX' | 'CREDIT_CARD' | 'BOLETO' | 'UNDEFINED';
  status: string;
  source: 'MANUAL' | 'AI';
  catalogItemId?: string | null;
  catalogItemSku?: string | null;
  catalogItemName?: string | null;
  expiresAt?: string;
  recurrence?: {
    frequency?: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
    startDate?: string;
    endDate?: string;
    totalValue?: number | null;
    nextRunAt?: string;
  };
  createdAt: string;
}

export interface ICreatePaymentLinkUseCase {
  execute(input: CreatePaymentLinkInput): Promise<CreatePaymentLinkOutput>;
}

export const ICreatePaymentLinkUseCase = Symbol('ICreatePaymentLinkUseCase');
