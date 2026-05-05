import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import { PaymentConfirmedIntegrationEvent } from '@modules/payment/application/integration-events/PaymentIntegrationEvents';
import {
  COMMERCE_REPOSITORY,
  ICommerceRepository,
} from '../../domain/ports/ICommerceRepository';
import { parseCommercePaymentReference } from '../services/CommercePaymentReference';
import { CommerceOrderPaidIntegrationEvent } from '../integration-events/CheckoutIntegrationEvents';

import {
  SALES_REPOSITORY,
  ISalesCouponRepository,
} from '@modules/sales/domain/repositories/ISalesRepository';

@Injectable()
export class CommercePaymentEventHandler implements OnModuleInit {
  constructor(
    @Inject(EVENT_BUS)
    private readonly eventBus: IEventBus,
    @Inject(COMMERCE_REPOSITORY)
    private readonly commerceRepository: ICommerceRepository,
    @Inject(SALES_REPOSITORY)
    private readonly salesRepository: ISalesCouponRepository,
  ) {}

  onModuleInit() {
    this.eventBus.subscribe(
      'payment.confirmed',
      async (event) => {
        const payload =
          event.payload as PaymentConfirmedIntegrationEvent['payload'];
        const parsedReference = parseCommercePaymentReference(
          payload.rawReference,
        );

        if (!parsedReference || parsedReference.tenantId !== payload.tenantId) {
          return;
        }

        const existingOrder =
          await this.commerceRepository.findOrderByPaymentReference(
            payload.tenantId,
            payload.rawReference!,
          );

        if (!existingOrder || existingOrder.status === 'PAID') {
          return;
        }

        const order = await this.commerceRepository.markOrderPaidByPaymentReference({
          tenantId: payload.tenantId,
          paymentReference: payload.rawReference!,
          paidAt: new Date(payload.confirmedAt),
        });

        if (order) {
          await this.commerceRepository.saveAuditLog({
            tenantId: payload.tenantId,
            event: 'ORDER_PAID',
            entityId: order.id,
            entityType: 'ORDER',
            metadata: {
              amount: payload.amount,
              reference: payload.rawReference,
            },
          });

          await this.eventBus.publish(
            new CommerceOrderPaidIntegrationEvent({
              orderId: order.id,
              tenantId: order.tenantId,
              paidAt: order.paidAt!,
              totalAmount: order.totalAmount,
            }),
          );

          if (order.couponCode) {
            const coupon = await this.salesRepository.findCouponByCode(
              order.tenantId,
              order.couponCode,
            );
            if (coupon) {
              await this.salesRepository.incrementCouponUsage(
                order.tenantId,
                coupon.id,
              );
            }
          }
        }
      },
      { consumerName: 'commerce-payment-confirmed' },
    );
  }
}
