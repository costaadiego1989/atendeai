import { IUseCase } from '@shared/application/IUseCase';
import { PlanType } from '../../../domain/value-objects/Quotas';

export interface BillingPlanOutput {
  code: PlanType;
  displayName: string;
  description?: string | null;
  monthlyPrice: number;
  messagesQuota: number;
  aiTokensQuota: number;
  contactsQuota: number;
  pricingVersion?: string | null;
  sortOrder: number;
  active: boolean;
  features?: string[];
  isStandard?: boolean;
  config?: any;
}

export interface ListBillingPlansInput {
  tenantId: string;
}

export interface ListBillingPlansOutput {
  tenantId: string;
  plans: BillingPlanOutput[];
}

export interface IListBillingPlansUseCase
  extends IUseCase<ListBillingPlansInput, ListBillingPlansOutput> {}

export const IListBillingPlansUseCase = Symbol('IListBillingPlansUseCase');
