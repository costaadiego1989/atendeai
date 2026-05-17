import { IUseCase } from '@shared/application/IUseCase';
import { PlanType } from '../../../domain/value-objects/Quotas';

export interface ChangeSubscriptionPlanInput {
  tenantId: string;
  targetPlan: PlanType;
}

export interface ChangeSubscriptionPlanOutput {
  tenantId: string;
  plan: PlanType;
  currentPlan: PlanType;
  targetPlan: PlanType;
  status: string;
  mode: 'NO_CHANGE' | 'CHECKOUT_REQUIRED' | 'DOWNGRADE_SCHEDULED';
  checkoutUrl?: string;
  effectiveAt?: Date;
}

export interface IChangeSubscriptionPlanUseCase extends IUseCase<
  ChangeSubscriptionPlanInput,
  ChangeSubscriptionPlanOutput
> {}

export const IChangeSubscriptionPlanUseCase = Symbol(
  'IChangeSubscriptionPlanUseCase',
);
