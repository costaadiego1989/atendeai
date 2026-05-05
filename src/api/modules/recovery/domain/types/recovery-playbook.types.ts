export type RecoveryPlaybookPhaseMode = 'AI' | 'TEMPLATE';

export interface RecoveryPlaybookRecord {
  id: string;
  tenantId: string;
  branchId: string | null;
  name: string;
  version: number;
  active: boolean;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface RecoveryPlaybookPhaseRecord {
  id: string;
  playbookId: string;
  sortOrder: number;
  channel: string;
  minDelayHoursSincePrevious: number;
  minDaysOverdue: number;
  mode: RecoveryPlaybookPhaseMode;
  templateBody: string | null;
}

export interface RecoveryPlaybookWithPhases {
  playbook: RecoveryPlaybookRecord;
  phases: RecoveryPlaybookPhaseRecord[];
}

export interface CreateRecoveryPlaybookPhaseInput {
  sortOrder: number;
  channel?: string;
  minDelayHoursSincePrevious?: number;
  minDaysOverdue?: number;
  mode: RecoveryPlaybookPhaseMode;
  templateBody?: string | null;
}

export interface CreateRecoveryPlaybookInput {
  tenantId: string;
  branchId?: string | null;
  name: string;
  phases: CreateRecoveryPlaybookPhaseInput[];
}
