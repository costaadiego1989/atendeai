import { Inject, Injectable } from '@nestjs/common';
import {
  EntityNotFoundException,
  ValidationErrorException,
} from '@shared/domain/exceptions/DomainExceptions';
import {
  IPaymentFacade,
  PAYMENT_FACADE,
} from '@modules/payment/application/facades/IPaymentFacade';
import {
  IRecoveryRepository,
  RECOVERY_REPOSITORY,
} from '../../domain/ports/IRecoveryRepository';
import { buildRecoveryPaymentReference } from '../services/RecoveryPaymentReference';
import { RecoveryCaseMessagingService } from '../services/RecoveryCaseMessagingService';

export interface GenerateRecoveryPaymentLinkCommand {
  tenantId: string;
  caseId: string;
  billingType?: 'UNDEFINED' | 'BOLETO' | 'CREDIT_CARD' | 'PIX';
  messageText?: string;
}

@Injectable()
export class GenerateRecoveryPaymentLinkUseCase {
  constructor(
    @Inject(RECOVERY_REPOSITORY)
    private readonly recoveryRepository: IRecoveryRepository,
    @Inject(PAYMENT_FACADE)
    private readonly paymentFacade: IPaymentFacade,
    private readonly recoveryCaseMessagingService: RecoveryCaseMessagingService,
  ) {}

  async execute(command: GenerateRecoveryPaymentLinkCommand) {
    const recoveryCase = await this.recoveryRepository.findCaseById(
      command.tenantId,
      command.caseId,
    );

    if (!recoveryCase) {
      throw new EntityNotFoundException('RecoveryCase', command.caseId);
    }

    if (!recoveryCase.amountDue) {
      throw new ValidationErrorException(
        'Caso de recovery precisa ter amountDue para gerar link de pagamento',
      );
    }

    const paymentReference =
      recoveryCase.paymentReference ||
      buildRecoveryPaymentReference(command.tenantId, recoveryCase.id);

    if (!recoveryCase.paymentReference) {
      await this.recoveryRepository.setPaymentReference({
        tenantId: command.tenantId,
        caseId: recoveryCase.id,
        paymentReference,
      });
    }

    const paymentLink = await this.paymentFacade.createPaymentLink({
      name: `Regularização - ${recoveryCase.debtorName}`,
      description: `Recovery case ${recoveryCase.id}`,
      value: Number(recoveryCase.amountDue),
      externalReference: paymentReference,
      billingType: command.billingType ?? 'UNDEFINED',
      chargeType: 'DETACHED',
      dueDateLimitDays: 3,
    });

    const queuedMessage = await this.recoveryCaseMessagingService.queueMessage({
      tenantId: command.tenantId,
      recoveryCase,
      text: this.resolvePaymentLinkMessage(
        command.messageText,
        recoveryCase.debtorName,
        recoveryCase.chargeTitle,
        paymentLink.url,
      ),
    });

    const updatedCase = await this.recoveryRepository.updateCaseStatus({
      tenantId: command.tenantId,
      caseId: recoveryCase.id,
      status: recoveryCase.status,
      contactId: queuedMessage.contactId,
      lastContactedAt: new Date(),
    });

    return {
      caseId: updatedCase.id,
      status: updatedCase.status,
      paymentReference,
      paymentLinkId: paymentLink.id,
      url: paymentLink.url,
      conversationId: queuedMessage.conversationId,
      messageId: queuedMessage.messageId,
    };
  }

  private buildPaymentLinkMessage(
    debtorName: string,
    chargeTitle: string | null | undefined,
    url: string,
  ): string {
    const title = chargeTitle?.trim();
    const opening = title
      ? `Oi, ${debtorName}. Segue o link para regularizar ${title}.`
      : `Oi, ${debtorName}. Segue o link para regularizar sua pendência.`;

    return `${opening}\n${url}\nSe precisar, posso te orientar por aqui.`;
  }

  private resolvePaymentLinkMessage(
    customText: string | undefined,
    debtorName: string,
    chargeTitle: string | null | undefined,
    url: string,
  ): string {
    const trimmed = customText?.trim();
    if (!trimmed) {
      return this.buildPaymentLinkMessage(debtorName, chargeTitle, url);
    }

    if (trimmed.includes('{{link}}')) {
      return trimmed.replace(/\{\{\s*link\s*\}\}/gi, url);
    }

    return `${trimmed}\n${url}`;
  }
}
