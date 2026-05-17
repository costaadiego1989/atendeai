import { Inject, Injectable } from '@nestjs/common';
import {
  EntityNotFoundException,
  ValidationErrorException,
} from '@shared/domain/exceptions/DomainExceptions';
import {
  RecoveryGuidanceInput,
  IRecoveryGuidanceGenerator,
  RECOVERY_GUIDANCE_GENERATOR,
} from '../ports/IRecoveryGuidanceGenerator';
import {
  IRecoveryRepository,
  RECOVERY_GUIDANCE_SENT_TAG,
  RECOVERY_REPOSITORY,
} from '../../domain/ports/IRecoveryRepository';

export interface RegenerateRecoveryGuidanceCommand {
  tenantId: string;
  caseId: string;
  customerMessage?: string;
}

@Injectable()
export class RegenerateRecoveryGuidanceUseCase {
  constructor(
    @Inject(RECOVERY_REPOSITORY)
    private readonly recoveryRepository: IRecoveryRepository,
    @Inject(RECOVERY_GUIDANCE_GENERATOR)
    private readonly recoveryGuidanceGenerator: IRecoveryGuidanceGenerator,
  ) {}

  async execute(command: RegenerateRecoveryGuidanceCommand) {
    const recoveryCase = await this.recoveryRepository.findCaseById(
      command.tenantId,
      command.caseId,
    );

    if (!recoveryCase) {
      throw new EntityNotFoundException('RecoveryCase', command.caseId);
    }

    if (
      recoveryCase.status === 'PAID' ||
      recoveryCase.status === 'STOPPED' ||
      recoveryCase.status === 'INVALID_CONTACT'
    ) {
      throw new ValidationErrorException(
        'A sugestão não pode ser atualizada para casos encerrados ou com contato inválido',
      );
    }

    const guidanceStatus =
      recoveryCase.status as RecoveryGuidanceInput['status'];

    const guidance = await this.recoveryGuidanceGenerator.generate({
      tenantId: command.tenantId,
      debtorName: recoveryCase.debtorName,
      debtorCompanyName: recoveryCase.debtorCompanyName,
      chargeType: recoveryCase.chargeType,
      chargeTitle: recoveryCase.chargeTitle,
      chargeDescription: recoveryCase.chargeDescription,
      referencePeriod: recoveryCase.referencePeriod,
      relatedEntityType: recoveryCase.relatedEntityType,
      relatedEntityLabel: recoveryCase.relatedEntityLabel,
      amountDue: recoveryCase.amountDue,
      dueDate: recoveryCase.dueDate,
      status: guidanceStatus,
      customerMessage: command.customerMessage,
    });

    return this.recoveryRepository.updateCaseGuidance({
      tenantId: command.tenantId,
      caseId: recoveryCase.id,
      suggestedReply: guidance.suggestedReply,
      suggestedNextAction: guidance.suggestedNextAction,
      guidanceGeneratedAt: new Date(),
      assignedTags: (recoveryCase.assignedTags ?? []).filter(
        (tag) => tag !== RECOVERY_GUIDANCE_SENT_TAG,
      ),
    });
  }
}
