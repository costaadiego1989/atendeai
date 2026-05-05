import { Inject, Injectable } from '@nestjs/common';
import {
  EntityNotFoundException,
  ValidationErrorException,
} from '@shared/domain/exceptions/DomainExceptions';
import {
  IRecoveryRepository,
  RECOVERY_REPOSITORY,
} from '../../domain/ports/IRecoveryRepository';

export interface UpdateRecoveryCaseStatusCommand {
  tenantId: string;
  caseId: string;
  status: string;
  nextActionAt?: string;
}

@Injectable()
export class UpdateRecoveryCaseStatusUseCase {
  constructor(
    @Inject(RECOVERY_REPOSITORY)
    private readonly recoveryRepository: IRecoveryRepository,
  ) {}

  async execute(command: UpdateRecoveryCaseStatusCommand) {
    const existingCase = await this.recoveryRepository.findCaseById(
      command.tenantId,
      command.caseId,
    );

    if (!existingCase) {
      throw new EntityNotFoundException('RecoveryCase', command.caseId);
    }

    const nextActionAt = command.nextActionAt
      ? new Date(command.nextActionAt)
      : undefined;

    if (
      command.status === 'PROMISE_TO_PAY' &&
      command.nextActionAt &&
      Number.isNaN(nextActionAt?.getTime())
    ) {
      throw new ValidationErrorException('nextActionAt invalido');
    }

    return this.recoveryRepository.updateCaseStatus({
      tenantId: command.tenantId,
      caseId: command.caseId,
      status: command.status,
      lastContactedAt:
        command.status === 'CONTACTED' ||
        command.status === 'NEGOTIATING' ||
        command.status === 'PROMISE_TO_PAY'
          ? new Date()
          : undefined,
      nextActionAt,
    });
  }
}
