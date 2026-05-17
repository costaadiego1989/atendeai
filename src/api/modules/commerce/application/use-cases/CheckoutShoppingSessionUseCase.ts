import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  COMMERCE_REPOSITORY,
  ICommerceRepository,
} from '../../domain/ports/ICommerceRepository';
import { ShoppingSessionNotFoundError } from '../../domain/errors/ShoppingSessionNotFoundError';
import { InvalidSessionStateError } from '../../domain/errors/InvalidSessionStateError';
import { PaymentService } from '@modules/payment/application/services/PaymentService';
import { buildCommercePaymentReference } from '../services/CommercePaymentReference';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import { CommerceCheckoutCreatedIntegrationEvent } from '../integration-events/CheckoutIntegrationEvents';

export interface CheckoutShoppingSessionInput {
  tenantId: string;
  sessionId: string;
  billingType?: 'PIX' | 'UNDEFINED' | 'BOLETO' | 'CREDIT_CARD';
  paymentLinkName?: string;
  paymentLinkDescription?: string;
}

@Injectable()
export class CheckoutShoppingSessionUseCase {
  constructor(
    @Inject(COMMERCE_REPOSITORY)
    private readonly commerceRepository: ICommerceRepository,
    private readonly paymentService: PaymentService,
    @Inject(EVENT_BUS)
    private readonly eventBus: IEventBus,
  ) {}

  async execute(input: CheckoutShoppingSessionInput) {
    const session = await this.commerceRepository.findSessionById(
      input.tenantId,
      input.sessionId,
    );

    if (!session) {
      throw new ShoppingSessionNotFoundError(input.sessionId);
    }

    if (session.items.length === 0) {
      throw new ConflictException('Add at least one item before checkout');
    }

    if (!session.fulfillmentType) {
      throw new BadRequestException(
        'Select pickup or delivery before checkout',
      );
    }

    if (
      session.fulfillmentType === 'DELIVERY' &&
      !session.deliveryAddress?.trim()
    ) {
      throw new BadRequestException(
        'Delivery address is required before checkout',
      );
    }

    if (session.status === 'PAID') {
      throw new InvalidSessionStateError(
        session.id,
        session.status,
        'CHECKOUT',
      );
    }

    const subtotalAmount = session.items.reduce(
      (acc, item) => acc + Number(item.lineTotal),
      0,
    );
    const freightAmount = Number(session.freightAmount ?? 0);
    const discountAmount = Number(session.discountAmount ?? 0);
    const totalAmount = subtotalAmount + freightAmount - discountAmount;
    const orderId = randomUUID();
    const paymentReference = buildCommercePaymentReference({
      tenantId: input.tenantId,
      orderId,
    });

    const paymentLink = await this.paymentService.createPaymentLink({
      name:
        input.paymentLinkName?.trim() ||
        `Pedido ${orderId.slice(0, 8).toUpperCase()}`,
      description:
        input.paymentLinkDescription?.trim() ||
        `Checkout conversacional da sessão ${session.id}`,
      value: totalAmount,
      externalReference: paymentReference,
      billingType: input.billingType ?? 'PIX',
      chargeType: 'DETACHED',
      dueDateLimitDays: 1,
    });

    const order = await this.commerceRepository.createOrder({
      id: orderId,
      tenantId: input.tenantId,
      branchId: session.branchId,
      sessionId: session.id,
      conversationId: session.conversationId,
      contactId: session.contactId,
      status: 'AWAITING_PAYMENT',
      fulfillmentType: session.fulfillmentType,
      shippingMode: session.shippingMode,
      subtotalAmount,
      freightAmount,
      totalAmount,
      deliveryAddress: session.deliveryAddress,
      paymentReference,
      paymentLinkId: paymentLink.id,
      paymentLinkUrl: paymentLink.url,
      paymentStatus: 'PENDING',
      couponCode: session.couponCode,
      discountAmount: session.discountAmount,
    });

    const updatedSession = await this.commerceRepository.updateSessionState({
      tenantId: input.tenantId,
      sessionId: session.id,
      status: 'AWAITING_PAYMENT',
      currentStep: 'AWAITING_PAYMENT',
      subtotalAmount,
      discountAmount,
      totalAmount,
      paymentReference,
      paymentLinkId: paymentLink.id,
      paymentLinkUrl: paymentLink.url,
      paymentStatus: 'PENDING',
      checkedOutAt: new Date(),
    });

    await this.commerceRepository.saveAuditLog({
      tenantId: input.tenantId,
      event: 'CHECKOUT_CREATED',
      entityId: order.id,
      entityType: 'ORDER',
      metadata: {
        sessionId: session.id,
        total: totalAmount,
      },
    });

    await this.eventBus.publish(
      new CommerceCheckoutCreatedIntegrationEvent({
        orderId: order.id,
        tenantId: order.tenantId,
        sessionId: session.id,
        conversationId: order.conversationId,
        contactId: order.contactId,
        paymentReference: order.paymentReference,
        paymentLinkId: order.paymentLinkId,
        paymentLinkUrl: order.paymentLinkUrl,
        fulfillmentType: order.fulfillmentType,
        shippingMode: order.shippingMode,
        subtotalAmount: order.subtotalAmount,
        freightAmount: order.freightAmount,
        totalAmount: order.totalAmount,
      }),
    );

    return {
      order,
      session: updatedSession,
      paymentLink,
    };
  }
}
