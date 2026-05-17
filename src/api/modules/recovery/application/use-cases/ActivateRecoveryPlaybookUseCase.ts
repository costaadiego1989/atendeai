import { Inject, Injectable } from '@nestjs/common';
import { EntityNotFoundException } from '@shared/domain/exceptions/DomainExceptions';
import {
  IRecoveryPlaybookRepository,
  RECOVERY_PLAYBOOK_REPOSITORY,
} from '../../domain/ports/IRecoveryPlaybookRepository';

@Injectable()
export class ActivateRecoveryPlaybookUseCase {
  constructor(
    @Inject(RECOVERY_PLAYBOOK_REPOSITORY)
    private readonly playbookRepository: IRecoveryPlaybookRepository,
  ) {}

  async execute(input: { tenantId: string; playbookId: string }) {
    const found = await this.playbookRepository.findPlaybookWithPhases(
      input.tenantId,
      input.playbookId,
    );
    if (!found) {
      throw new EntityNotFoundException('RecoveryPlaybook', input.playbookId);
    }
    return this.playbookRepository.activatePlaybook(
      input.tenantId,
      input.playbookId,
    );
  }
}
