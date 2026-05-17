import { IUseCase } from '@shared/application/IUseCase';

export interface CancelSubscriptionInput {
  tenantId: string;
}

export interface CancelSubscriptionOutput {
  tenantId: string;
  status: string;
}

export interface ICancelSubscriptionUseCase extends IUseCase<
  CancelSubscriptionInput,
  CancelSubscriptionOutput
> {}

export const ICancelSubscriptionUseCase = Symbol('ICancelSubscriptionUseCase');
