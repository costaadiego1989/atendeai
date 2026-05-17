export interface RecoveryOutreachInput {
  tenantId: string;
  debtorName: string;
  debtorCompanyName?: string | null;
  chargeType?: string | null;
  chargeTitle?: string | null;
  chargeDescription?: string | null;
  referencePeriod?: string | null;
  relatedEntityType?: string | null;
  relatedEntityLabel?: string | null;
  amountDue?: string | null;
  dueDate?: Date | null;
  assignedTags: string[];
}

export interface IRecoveryOutreachGenerator {
  generate(input: RecoveryOutreachInput): Promise<string>;
}

export const RECOVERY_OUTREACH_GENERATOR = Symbol(
  'RECOVERY_OUTREACH_GENERATOR',
);
