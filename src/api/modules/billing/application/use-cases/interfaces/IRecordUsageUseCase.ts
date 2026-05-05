export enum UsageType {
  MESSAGE = 'MESSAGE',
  AI_TOKEN = 'AI_TOKEN',
  CONTACT = 'CONTACT',
}

export interface RecordUsageInput {
  tenantId: string;
  type: UsageType;
  amount?: number;
}

export interface IRecordUsageUseCase {
  execute(input: RecordUsageInput): Promise<void>;
}

export const IRecordUsageUseCase = Symbol('IRecordUsageUseCase');
