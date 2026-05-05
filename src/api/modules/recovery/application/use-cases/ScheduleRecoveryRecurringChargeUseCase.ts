import { Inject, Injectable } from '@nestjs/common';
import {
  EntityNotFoundException,
  ValidationErrorException,
} from '@shared/domain/exceptions/DomainExceptions';
import {
  IRecoveryRecurringChargeRepository,
  RECOVERY_RECURRING_CHARGE_REPOSITORY,
} from '../../domain/ports/IRecoveryRecurringChargeRepository';
import {
  IRecoveryRepository,
  RECOVERY_REPOSITORY,
} from '../../domain/ports/IRecoveryRepository';

export interface ScheduleRecoveryRecurringChargeCommand {
  tenantId: string;
  caseId: string;
  billingType?: 'UNDEFINED' | 'BOLETO' | 'CREDIT_CARD' | 'PIX';
  intervalDays: number;
  maxOccurrences?: number | null;
  firstRunAt?: Date;
  messageTemplate?: string | null;
  createdByUserId?: string | null;
  createdByUserEmail?: string | null;
}

@Injectable()
export class ScheduleRecoveryRecurringChargeUseCase {
  constructor(
    @Inject(RECOVERY_REPOSITORY)
    private readonly recoveryRepository: IRecoveryRepository,
    @Inject(RECOVERY_RECURRING_CHARGE_REPOSITORY)
    private readonly recurringChargeRepository: IRecoveryRecurringChargeRepository,
  ) { }

  async execute(command: ScheduleRecoveryRecurringChargeCommand) {
    this.validate(command);

    const recoveryCase = await this.recoveryRepository.findCaseById(
      command.tenantId,
      command.caseId,
    );

    if (!recoveryCase) {
      throw new EntityNotFoundException('RecoveryCase', command.caseId);
    }

    if (!recoveryCase.amountDue) {
      throw new ValidationErrorException(
        'Caso de recovery precisa ter amountDue para recorrência de Cobrança',
      );
    }

    if (['PAID', 'STOPPED', 'INVALID_CONTACT'].includes(recoveryCase.status)) {
      throw new ValidationErrorException(
        'recorrência não pode ser criada para um caso pago, parado ou com contato invalido',
      );
    }

    const recurrence = await this.recurringChargeRepository.create({
      tenantId: command.tenantId,
      branchId: recoveryCase.branchId ?? null,
      caseId: recoveryCase.id,
      billingType: command.billingType ?? 'UNDEFINED',
      intervalDays: command.intervalDays,
      maxOccurrences: command.maxOccurrences ?? null,
      firstRunAt: command.firstRunAt ?? new Date(),
      messageTemplate: command.messageTemplate?.trim() || null,
      createdByUserId: command.createdByUserId ?? null,
      createdByUserEmail: command.createdByUserEmail ?? null,
    });

    await this.recoveryRepository.updateCaseStatus({
      tenantId: command.tenantId,
      caseId: recoveryCase.id,
      status: recoveryCase.status === 'READY_TO_CONTACT'
        ? 'CONTACTED'
        : recoveryCase.status,
      nextActionAt: recurrence.nextRunAt ?? null,
    });

    return recurrence;
  }

  private validate(command: ScheduleRecoveryRecurringChargeCommand): void {
    if (!Number.isInteger(command.intervalDays) || command.intervalDays < 1) {
      throw new ValidationErrorException(
        'intervalDays deve ser um numero inteiro maior ou igual a 1',
      );
    }

    if (command.intervalDays > 365) {
      throw new ValidationErrorException(
        'intervalDays deve ser menor ou igual a 365',
      );
    }

    if (
      command.maxOccurrences != null &&
      (!Number.isInteger(command.maxOccurrences) || command.maxOccurrences < 1)
    ) {
      throw new ValidationErrorException(
        'maxOccurrences deve ser um numero inteiro maior ou igual a 1',
      );
    }
  }
}
