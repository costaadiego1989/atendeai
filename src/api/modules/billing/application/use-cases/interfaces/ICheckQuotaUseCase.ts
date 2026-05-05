import { IUseCase } from '@shared/application/IUseCase';
import { UsageType } from './IRecordUsageUseCase';

export interface CheckQuotaInput {
  tenantId: string;
  type: UsageType;
}

export interface CheckQuotaOutput {
  canProceed: boolean;
  used: number;
  quota: number;
  status: string;
}

export interface ICheckQuotaUseCase extends IUseCase<
  CheckQuotaInput,
  CheckQuotaOutput
> {}
export const ICheckQuotaUseCase = Symbol('ICheckQuotaUseCase');
