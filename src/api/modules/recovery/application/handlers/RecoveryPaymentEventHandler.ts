import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import { PaymentConfirmedIntegrationEvent } from '@modules/payment/application/integration-events/PaymentIntegrationEvents';
import {
  IRecoveryRepository,
  RECOVERY_REPOSITORY,
} from '../../domain/ports/IRecoveryRepository';
import {
  IRecoveryRecurringChargeRepository,
  RECOVERY_RECURRING_CHARGE_REPOSITORY,
} from '../../domain/ports/IRecoveryRecurringChargeRepository';
import { parseRecoveryPaymentReference } from '../services/RecoveryPaymentReference';

@Injectable()
export class RecoveryPaymentEventHandler implements OnModuleInit {
  constructor(
    @Inject(EVENT_BUS)
    private readonly eventBus: IEventBus,
    @Inject(RECOVERY_REPOSITORY)
    private readonly recoveryRepository: IRecoveryRepository,
    @Inject(RECOVERY_RECURRING_CHARGE_REPOSITORY)
    private readonly recurringChargeRepository: IRecoveryRecurringChargeRepository,
  ) {}

  onModuleInit() {
    this.eventBus.subscribe(
      'payment.confirmed',
      async (event) => {
        const payload =
          event.payload as PaymentConfirmedIntegrationEvent['payload'];
        const parsedReference = parseRecoveryPaymentReference(
          payload.rawReference,
        );

        if (!parsedReference || parsedReference.tenantId !== payload.tenantId) {
          return;
        }

        const recoveryCase =
          await this.recoveryRepository.findCaseByPaymentReference(
            payload.tenantId,
            payload.rawReference!,
          );

        if (!recoveryCase || recoveryCase.status === 'PAID') {
          return;
        }

        await this.recoveryRepository.updateCaseStatus({
          tenantId: payload.tenantId,
          caseId: recoveryCase.id,
          status: 'PAID',
          nextActionAt: null,
          paidAt: new Date(payload.confirmedAt),
        });
        await this.recurringChargeRepository.cancelActiveByCase({
          tenantId: payload.tenantId,
          caseId: recoveryCase.id,
          reason: 'payment_confirmed',
        });
      },
      { consumerName: 'recovery-payment-confirmed' },
    );
  }
}
