import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import {
  RecoveryRecurringChargeDueIntegrationEvent,
  RecoveryRecurringChargeDuePayload,
} from '../../domain/events/integration/RecoveryRecurringChargeDueIntegrationEvent';
import { ProcessRecoveryRecurringChargeUseCase } from '../use-cases/ProcessRecoveryRecurringChargeUseCase';

@Injectable()
export class RecoveryRecurringChargeDueHandler implements OnModuleInit {
  constructor(
    @Inject(EVENT_BUS)
    private readonly eventBus: IEventBus,
    private readonly processRecoveryRecurringChargeUseCase: ProcessRecoveryRecurringChargeUseCase,
  ) {}

  onModuleInit() {
    this.eventBus.subscribe<RecoveryRecurringChargeDueIntegrationEvent>(
      'recovery.recurring-charge.due',
      async (event) => {
        const payload = event.payload as RecoveryRecurringChargeDuePayload;
        await this.processRecoveryRecurringChargeUseCase.execute({
          tenantId: payload.tenantId,
          recurrenceId: payload.recurrenceId,
        });
      },
      {
        consumerName: 'recovery-recurring-charge-due',
        concurrency: 5,
      },
    );
  }
}
