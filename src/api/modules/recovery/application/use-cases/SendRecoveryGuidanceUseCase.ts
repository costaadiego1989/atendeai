import { Inject, Injectable } from '@nestjs/common';
import {
  EntityNotFoundException,
  ValidationErrorException,
} from '@shared/domain/exceptions/DomainExceptions';
import {
  IRecoveryRepository,
  RECOVERY_GUIDANCE_SENT_TAG,
  RECOVERY_REPOSITORY,
} from '../../domain/ports/IRecoveryRepository';
import { RecoveryCaseMessagingService } from '../services/RecoveryCaseMessagingService';

export interface SendRecoveryGuidanceCommand {
  tenantId: string;
  caseId: string;
}

@Injectable()
export class SendRecoveryGuidanceUseCase {
  constructor(
    @Inject(RECOVERY_REPOSITORY)
    private readonly recoveryRepository: IRecoveryRepository,
    private readonly recoveryCaseMessagingService: RecoveryCaseMessagingService,
  ) {}

  async execute(command: SendRecoveryGuidanceCommand) {
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
        'It is not possible to send a suggestion for closed cases or invalid contacts',
      );
    }

    if (!recoveryCase.suggestedReply?.trim()) {
      throw new ValidationErrorException(
        'Generate a suggestion before sending the response to the customer',
      );
    }

    const queuedMessage = await this.recoveryCaseMessagingService.queueMessage({
      tenantId: command.tenantId,
      recoveryCase,
      text: recoveryCase.suggestedReply,
    });

    const nextAssignedTags = Array.from(
      new Set([
        ...(recoveryCase.assignedTags ?? []),
        RECOVERY_GUIDANCE_SENT_TAG,
      ]),
    );

    const updatedCase = await this.recoveryRepository.updateCaseStatus({
      tenantId: command.tenantId,
      caseId: command.caseId,
      status: recoveryCase.status,
      contactId: queuedMessage.contactId,
      assignedTags: nextAssignedTags,
      lastContactedAt: new Date(),
    });

    return {
      ...updatedCase,
      conversationId: queuedMessage.conversationId,
      messageId: queuedMessage.messageId,
      sentText: recoveryCase.suggestedReply,
    };
  }
}
