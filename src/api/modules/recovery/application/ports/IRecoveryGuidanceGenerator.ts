export interface RecoveryGuidanceInput {
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
  status:
    | 'READY_TO_CONTACT'
    | 'CONTACTED'
    | 'NEGOTIATING'
    | 'PROMISE_TO_PAY'
    | 'NO_RESPONSE';
  customerMessage?: string;
}

export interface RecoveryGuidanceOutput {
  suggestedReply: string;
  suggestedNextAction: string;
}

export interface IRecoveryGuidanceGenerator {
  generate(input: RecoveryGuidanceInput): Promise<RecoveryGuidanceOutput>;
}

export const RECOVERY_GUIDANCE_GENERATOR = Symbol('RECOVERY_GUIDANCE_GENERATOR');
