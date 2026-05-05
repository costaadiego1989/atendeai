import { Inject, Injectable } from '@nestjs/common';
import {
  IRecoveryPlaybookRepository,
  RECOVERY_PLAYBOOK_REPOSITORY,
} from '../../domain/ports/IRecoveryPlaybookRepository';
import { RecoveryPlaybookWithPhases } from '../../domain/types/recovery-playbook.types';

@Injectable()
export class ListRecoveryPlaybooksUseCase {
  constructor(
    @Inject(RECOVERY_PLAYBOOK_REPOSITORY)
    private readonly playbookRepository: IRecoveryPlaybookRepository,
  ) {}

  async execute(input: { tenantId: string }): Promise<RecoveryPlaybookWithPhases[]> {
    await this.playbookRepository.ensureSystemDefaultPlaybook(input.tenantId);
    const playbooks = await this.playbookRepository.listPlaybooks(input.tenantId);
    const withPhases: RecoveryPlaybookWithPhases[] = [];
    for (const pb of playbooks) {
      const phases = await this.playbookRepository.listPhases(pb.id);
      withPhases.push({ playbook: pb, phases });
    }
    return withPhases;
  }
}
