import { Inject, Injectable } from '@nestjs/common';
import { ValidationErrorException } from '@shared/domain/exceptions/DomainExceptions';
import {
  IRecoveryPlaybookRepository,
  RECOVERY_PLAYBOOK_REPOSITORY,
} from '../../domain/ports/IRecoveryPlaybookRepository';
import { CreateRecoveryPlaybookInput } from '../../domain/types/recovery-playbook.types';

@Injectable()
export class CreateRecoveryPlaybookUseCase {
  constructor(
    @Inject(RECOVERY_PLAYBOOK_REPOSITORY)
    private readonly playbookRepository: IRecoveryPlaybookRepository,
  ) {}

  async execute(input: CreateRecoveryPlaybookInput) {
    if (!input.phases?.length) {
      throw new ValidationErrorException(
        'Indique pelo menos uma fase no playbook',
      );
    }
    for (const p of input.phases) {
      if (p.mode === 'TEMPLATE' && !p.templateBody?.trim()) {
        throw new ValidationErrorException('Fase TEMPLATE requer templateBody');
      }
    }
    return this.playbookRepository.createPlaybook(input);
  }
}
