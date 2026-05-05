import { Inject, Injectable } from '@nestjs/common';
import { EntityNotFoundException } from '@shared/domain/exceptions/DomainExceptions';
import {
  IRecoveryRepository,
  RECOVERY_REPOSITORY,
} from '../../domain/ports/IRecoveryRepository';

export interface GetRecoveryCaseCommand {
  tenantId: string;
  caseId: string;
}

@Injectable()
export class GetRecoveryCaseUseCase {
  constructor(
    @Inject(RECOVERY_REPOSITORY)
    private readonly recoveryRepository: IRecoveryRepository,
  ) {}

  async execute(command: GetRecoveryCaseCommand) {
    const recoveryCase = await this.recoveryRepository.findCaseById(
      command.tenantId,
      command.caseId,
    );

    if (!recoveryCase) {
      throw new EntityNotFoundException('RecoveryCase', command.caseId);
    }

    return recoveryCase;
  }
}
