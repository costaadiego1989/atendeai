export interface RecoveryCaseRecord {
  id: string;
  tenantId: string;
  branchId?: string | null;
  contactId?: string | null;
  debtorName: string;
  debtorCompanyName?: string | null;
  debtorDocument?: string | null;
  phone: string;
  externalReference?: string | null;
  paymentReference?: string | null;
  source: string;
  chargeType?: string | null;
  chargeTitle?: string | null;
  chargeDescription?: string | null;
  referencePeriod?: string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  relatedEntityLabel?: string | null;
  amountDue?: string | null;
  dueDate?: Date | null;
  status: string;
  assignedTags: string[];
  lastContactedAt?: Date | null;
  nextActionAt?: Date | null;
  paidAt?: Date | null;
  suggestedReply?: string | null;
  suggestedNextAction?: string | null;
  guidanceGeneratedAt?: Date | null;
  playbookId?: string | null;
  playbookPhaseIndex?: number;
  lastPlaybookPhaseExecutedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export const RECOVERY_GUIDANCE_SENT_TAG = 'system:guidance_sent';

export interface CreateRecoveryCaseInput {
  tenantId: string;
  branchId?: string;
  contactId?: string;
  debtorName: string;
  debtorCompanyName?: string;
  debtorDocument?: string;
  phone: string;
  externalReference?: string;
  paymentReference?: string;
  source: string;
  chargeType?: string;
  chargeTitle?: string;
  chargeDescription?: string;
  referencePeriod?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  relatedEntityLabel?: string;
  amountDue?: string;
  dueDate?: Date;
  assignedTags?: string[];
  playbookId?: string | null;
}

export interface ListRecoveryCasesFilters {
  tenantId: string;
  branchId?: string;
  status?: string;
  source?: string;
  dateFrom?: Date | null;
  dateTo?: Date | null;
}

export interface IRecoveryRepository {
  createCase(input: CreateRecoveryCaseInput): Promise<RecoveryCaseRecord>;
  listCases(filters: ListRecoveryCasesFilters): Promise<RecoveryCaseRecord[]>;
  findCaseById(
    tenantId: string,
    caseId: string,
  ): Promise<RecoveryCaseRecord | null>;
  findLatestActiveCaseByContact(
    tenantId: string,
    contactId: string,
  ): Promise<RecoveryCaseRecord | null>;
  findCaseByPaymentReference(
    tenantId: string,
    paymentReference: string,
  ): Promise<RecoveryCaseRecord | null>;
  updateCaseStatus(input: {
    tenantId: string;
    caseId: string;
    status: string;
    contactId?: string;
    assignedTags?: string[];
    lastContactedAt?: Date | null;
    nextActionAt?: Date | null;
    paidAt?: Date | null;
  }): Promise<RecoveryCaseRecord>;
  updateCaseGuidance(input: {
    tenantId: string;
    caseId: string;
    suggestedReply?: string | null;
    suggestedNextAction?: string | null;
    guidanceGeneratedAt?: Date | null;
    assignedTags?: string[];
  }): Promise<RecoveryCaseRecord>;
  updateCasePlaybookProgress(input: {
    tenantId: string;
    caseId: string;
    playbookPhaseIndex: number;
    lastPlaybookPhaseExecutedAt: Date;
  }): Promise<RecoveryCaseRecord>;
  setPaymentReference(input: {
    tenantId: string;
    caseId: string;
    paymentReference: string;
  }): Promise<RecoveryCaseRecord>;
}

export const RECOVERY_REPOSITORY = Symbol('RECOVERY_REPOSITORY');
