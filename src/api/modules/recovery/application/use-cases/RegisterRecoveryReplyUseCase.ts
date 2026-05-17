import { Inject, Injectable } from '@nestjs/common';
import {
  IRecoveryRepository,
  RECOVERY_REPOSITORY,
} from '../../domain/ports/IRecoveryRepository';
import {
  IRecoveryGuidanceGenerator,
  RECOVERY_GUIDANCE_GENERATOR,
} from '../ports/IRecoveryGuidanceGenerator';
import { RecoveryReplyPolicy } from '../services/RecoveryReplyPolicy';

export interface RegisterRecoveryReplyCommand {
  tenantId: string;
  contactId: string;
  messageText?: string;
}

@Injectable()
export class RegisterRecoveryReplyUseCase {
  constructor(
    @Inject(RECOVERY_REPOSITORY)
    private readonly recoveryRepository: IRecoveryRepository,
    private readonly recoveryReplyPolicy: RecoveryReplyPolicy,
    @Inject(RECOVERY_GUIDANCE_GENERATOR)
    private readonly recoveryGuidanceGenerator: IRecoveryGuidanceGenerator,
  ) {}

  async execute(command: RegisterRecoveryReplyCommand) {
    const recoveryCase =
      await this.recoveryRepository.findLatestActiveCaseByContact(
        command.tenantId,
        command.contactId,
      );

    if (!recoveryCase) {
      return null;
    }

    const nextStatus = this.recoveryReplyPolicy.classify(command.messageText);

    const updatedCase = await this.recoveryRepository.updateCaseStatus({
      tenantId: command.tenantId,
      caseId: recoveryCase.id,
      status: nextStatus,
      lastContactedAt: new Date(),
      nextActionAt: nextStatus === 'STOPPED' ? null : undefined,
    });

    if (nextStatus === 'NEGOTIATING' || nextStatus === 'PROMISE_TO_PAY') {
      const guidance = await this.recoveryGuidanceGenerator.generate({
        tenantId: command.tenantId,
        debtorName: updatedCase.debtorName,
        debtorCompanyName: updatedCase.debtorCompanyName,
        chargeType: updatedCase.chargeType,
        chargeTitle: updatedCase.chargeTitle,
        chargeDescription: updatedCase.chargeDescription,
        referencePeriod: updatedCase.referencePeriod,
        relatedEntityType: updatedCase.relatedEntityType,
        relatedEntityLabel: updatedCase.relatedEntityLabel,
        amountDue: updatedCase.amountDue,
        dueDate: updatedCase.dueDate,
        status: nextStatus,
        customerMessage: command.messageText,
      });

      return this.recoveryRepository.updateCaseGuidance({
        tenantId: command.tenantId,
        caseId: updatedCase.id,
        suggestedReply: guidance.suggestedReply,
        suggestedNextAction: guidance.suggestedNextAction,
        guidanceGeneratedAt: new Date(),
      });
    }

    return this.recoveryRepository.updateCaseGuidance({
      tenantId: command.tenantId,
      caseId: updatedCase.id,
      suggestedReply: null,
      suggestedNextAction: null,
      guidanceGeneratedAt: null,
    });
  }
}
