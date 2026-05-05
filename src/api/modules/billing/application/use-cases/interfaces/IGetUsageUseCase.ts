import { IUseCase } from '@shared/application/IUseCase';

export interface GetUsageInput {
  tenantId: string;
}

export interface GetUsageOutput {
  tenantId: string;
  plan: string;
  scheduledPlan?: string;
  currentPeriod: {
    start: Date | undefined;
    end: Date | undefined;
  };
  usage: {
    messages: { used: number; quota: number };
    aiTokens: { used: number; quota: number };
    contacts: { used: number; quota: number };
  };
}

export interface IGetUsageUseCase extends IUseCase<
  GetUsageInput,
  GetUsageOutput
> {}
export const IGetUsageUseCase = Symbol('IGetUsageUseCase');
