import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  IRecoveryRecurringChargeRepository,
  RECOVERY_RECURRING_CHARGE_REPOSITORY,
  RecoveryRecurringChargeRecord,
} from '../../domain/ports/IRecoveryRecurringChargeRepository';
import {
  IRecoveryRepository,
  RECOVERY_REPOSITORY,
  RecoveryCaseRecord,
} from '../../domain/ports/IRecoveryRepository';
import { GenerateRecoveryPaymentLinkUseCase } from './GenerateRecoveryPaymentLinkUseCase';

@Injectable()
export class ProcessRecoveryRecurringChargeUseCase {
  private readonly logger = new Logger(
    ProcessRecoveryRecurringChargeUseCase.name,
  );

  constructor(
    @Inject(RECOVERY_RECURRING_CHARGE_REPOSITORY)
    private readonly recurringChargeRepository: IRecoveryRecurringChargeRepository,
    @Inject(RECOVERY_REPOSITORY)
    private readonly recoveryRepository: IRecoveryRepository,
    private readonly generateRecoveryPaymentLinkUseCase: GenerateRecoveryPaymentLinkUseCase,
  ) {}

  async execute(input: {
    tenantId: string;
    recurrenceId: string;
  }): Promise<void> {
    const recurrence = await this.recurringChargeRepository.findById(
      input.tenantId,
      input.recurrenceId,
    );

    if (
      !recurrence ||
      recurrence.status !== 'ACTIVE' ||
      !recurrence.nextRunAt
    ) {
      return;
    }

    const now = new Date();
    if (recurrence.nextRunAt.getTime() > now.getTime() + 30_000) {
      await this.recurringChargeRepository.releaseLease({
        tenantId: recurrence.tenantId,
        recurrenceId: recurrence.id,
      });
      return;
    }

    const recoveryCase = await this.recoveryRepository.findCaseById(
      recurrence.tenantId,
      recurrence.caseId,
    );

    const occurrenceNumber = recurrence.occurrencesSent + 1;
    const run = await this.recurringChargeRepository.startRun({
      recurrenceId: recurrence.id,
      tenantId: recurrence.tenantId,
      caseId: recurrence.caseId,
      occurrenceNumber,
      scheduledFor: recurrence.nextRunAt,
    });

    if (!run) {
      await this.recurringChargeRepository.releaseLease({
        tenantId: recurrence.tenantId,
        recurrenceId: recurrence.id,
      });
      return;
    }

    if (!recoveryCase || this.isTerminalCase(recoveryCase)) {
      await this.recurringChargeRepository.markRunSkipped({
        runId: run.id,
        reason: recoveryCase
          ? `terminal_case_${recoveryCase.status}`
          : 'case_not_found',
      });
      await this.recurringChargeRepository.cancel({
        tenantId: recurrence.tenantId,
        recurrenceId: recurrence.id,
        reason: recoveryCase
          ? `terminal_case_${recoveryCase.status}`
          : 'case_not_found',
      });
      return;
    }

    try {
      const result = await this.generateRecoveryPaymentLinkUseCase.execute({
        tenantId: recurrence.tenantId,
        caseId: recurrence.caseId,
        billingType: recurrence.billingType,
        messageText: this.formatMessageTemplate(recurrence, recoveryCase),
      });

      await this.recurringChargeRepository.markRunSucceeded({
        runId: run.id,
        paymentLinkId: result.paymentLinkId,
        conversationId: result.conversationId,
        messageId: result.messageId,
      });

      const nextRunAt = this.computeNextRunAt(recurrence, occurrenceNumber);
      await this.recurringChargeRepository.advanceAfterSuccess({
        tenantId: recurrence.tenantId,
        recurrenceId: recurrence.id,
        occurrenceNumber,
        nextRunAt,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Falha ao processar recorrência';
      this.logger.error(
        `Recovery recurring charge ${recurrence.id} failed: ${message}`,
      );
      await this.recurringChargeRepository.markRunFailed({
        runId: run.id,
        errorMessage: message,
      });
      await this.recurringChargeRepository.releaseLease({
        tenantId: recurrence.tenantId,
        recurrenceId: recurrence.id,
        errorMessage: message,
      });
      throw error;
    }
  }

  private isTerminalCase(recoveryCase: RecoveryCaseRecord): boolean {
    return ['PAID', 'STOPPED', 'INVALID_CONTACT'].includes(recoveryCase.status);
  }

  private computeNextRunAt(
    recurrence: RecoveryRecurringChargeRecord,
    occurrenceNumber: number,
  ): Date | null {
    if (
      recurrence.maxOccurrences != null &&
      occurrenceNumber >= recurrence.maxOccurrences
    ) {
      return null;
    }

    const base = recurrence.nextRunAt ?? new Date();
    const nextRunAt = new Date(base);
    nextRunAt.setUTCDate(nextRunAt.getUTCDate() + recurrence.intervalDays);
    return nextRunAt;
  }

  private formatMessageTemplate(
    recurrence: RecoveryRecurringChargeRecord,
    recoveryCase: RecoveryCaseRecord,
  ): string | undefined {
    const template = recurrence.messageTemplate?.trim();
    if (!template) {
      return undefined;
    }

    return template
      .replace(/\{\{\s*nome\s*\}\}/gi, recoveryCase.debtorName)
      .replace(
        /\{\{\s*titulo\s*\}\}/gi,
        recoveryCase.chargeTitle ?? 'pendencia',
      )
      .replace(/\{\{\s*valor\s*\}\}/gi, recoveryCase.amountDue ?? '')
      .replace(/\{\{\s*link\s*\}\}/gi, '{{link}}');
  }
}
