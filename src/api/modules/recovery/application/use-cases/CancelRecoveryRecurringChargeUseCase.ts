import { Inject, Injectable } from '@nestjs/common';
import { EntityNotFoundException } from '@shared/domain/exceptions/DomainExceptions';
import {
  IRecoveryRecurringChargeRepository,
  RECOVERY_RECURRING_CHARGE_REPOSITORY,
} from '../../domain/ports/IRecoveryRecurringChargeRepository';

@Injectable()
export class CancelRecoveryRecurringChargeUseCase {
  constructor(
    @Inject(RECOVERY_RECURRING_CHARGE_REPOSITORY)
    private readonly recurringChargeRepository: IRecoveryRecurringChargeRepository,
  ) {}

  async execute(input: {
    tenantId: string;
    recurrenceId: string;
    reason?: string;
  }) {
    const recurrence = await this.recurringChargeRepository.findById(
      input.tenantId,
      input.recurrenceId,
    );

    if (!recurrence) {
      throw new EntityNotFoundException(
        'RecoveryRecurringCharge',
        input.recurrenceId,
      );
    }

    if (recurrence.status !== 'ACTIVE' && recurrence.status !== 'PAUSED') {
      return recurrence;
    }

    return this.recurringChargeRepository.cancel({
      tenantId: input.tenantId,
      recurrenceId: input.recurrenceId,
      reason: input.reason ?? 'cancelled_by_user',
    });
  }
}
