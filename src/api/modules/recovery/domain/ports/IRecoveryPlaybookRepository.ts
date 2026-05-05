import {
  CreateRecoveryPlaybookInput,
  RecoveryPlaybookPhaseRecord,
  RecoveryPlaybookRecord,
  RecoveryPlaybookWithPhases,
} from '../types/recovery-playbook.types';

export interface IRecoveryPlaybookRepository {
  ensureSystemDefaultPlaybook(tenantId: string): Promise<RecoveryPlaybookWithPhases | null>;

  listPlaybooks(tenantId: string): Promise<RecoveryPlaybookRecord[]>;

  listPhases(playbookId: string): Promise<RecoveryPlaybookPhaseRecord[]>;

  findPlaybookWithPhases(
    tenantId: string,
    playbookId: string,
  ): Promise<RecoveryPlaybookWithPhases | null>;

  findActivePlaybookWithPhases(
    tenantId: string,
    branchId?: string | null,
  ): Promise<RecoveryPlaybookWithPhases | null>;

  createPlaybook(input: CreateRecoveryPlaybookInput): Promise<RecoveryPlaybookWithPhases>;

  activatePlaybook(tenantId: string, playbookId: string): Promise<RecoveryPlaybookRecord>;

  hasDispatchedPhase(caseId: string, phaseId: string): Promise<boolean>;

  recordPhaseDispatch(input: {
    tenantId: string;
    caseId: string;
    phaseId: string;
  }): Promise<void>;
}

export const RECOVERY_PLAYBOOK_REPOSITORY = Symbol('RECOVERY_PLAYBOOK_REPOSITORY');
