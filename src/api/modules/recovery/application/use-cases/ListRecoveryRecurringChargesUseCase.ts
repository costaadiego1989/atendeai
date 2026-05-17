import { Inject, Injectable } from '@nestjs/common';
import {
  IRecoveryRecurringChargeRepository,
  RECOVERY_RECURRING_CHARGE_REPOSITORY,
} from '../../domain/ports/IRecoveryRecurringChargeRepository';

@Injectable()
export class ListRecoveryRecurringChargesUseCase {
  constructor(
    @Inject(RECOVERY_RECURRING_CHARGE_REPOSITORY)
    private readonly recurringChargeRepository: IRecoveryRecurringChargeRepository,
  ) {}

  async execute(input: { tenantId: string; caseId: string }) {
    return this.recurringChargeRepository.listByCase(
      input.tenantId,
      input.caseId,
    );
  }
}
