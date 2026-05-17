import { Inject, Injectable } from '@nestjs/common';
import {
  IRecoveryPlaybookRepository,
  RECOVERY_PLAYBOOK_REPOSITORY,
} from '../../domain/ports/IRecoveryPlaybookRepository';
import { RecoveryPlaybookWithPhases } from '../../domain/types/recovery-playbook.types';

@Injectable()
export class SeedDefaultRecoveryPlaybookUseCase {
  constructor(
    @Inject(RECOVERY_PLAYBOOK_REPOSITORY)
    private readonly playbookRepository: IRecoveryPlaybookRepository,
  ) {}

  async execute(input: { tenantId: string }): Promise<{
    seeded: boolean;
    playbook: RecoveryPlaybookWithPhases | null;
  }> {
    const created = await this.playbookRepository.ensureSystemDefaultPlaybook(
      input.tenantId,
    );
    if (created) {
      return { seeded: true, playbook: created };
    }
    const active = await this.playbookRepository.findActivePlaybookWithPhases(
      input.tenantId,
      null,
    );
    return { seeded: false, playbook: active };
  }
}
