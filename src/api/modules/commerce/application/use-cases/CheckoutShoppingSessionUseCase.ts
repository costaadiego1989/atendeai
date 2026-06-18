import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  COMMERCE_REPOSITORY,
  ICommerceRepository,
} from '../../domain/ports/ICommerceRepository';
import { ShoppingSessionNotFoundError } from '../../domain/errors/ShoppingSessionNotFoundError';
import { InvalidSessionStateError } from '../../domain/errors/InvalidSessionStateError';
import { SessionAlreadyProcessingException } from '../../domain/errors/SessionAlreadyProcessingException';
import {
  IPaymentFacade,
  PAYMENT_FACADE,
} from '@modules/payment/application/facades/IPaymentFacade';
import { buildCommercePaymentReference } from '../services/CommercePaymentReference';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import { CommerceCheckoutCreatedIntegrationEvent } from '../integration-events/CheckoutIntegrationEvents';
import { ShoppingSession } from '../../domain/entities/ShoppingSession';

export interface CheckoutShoppingSessionInput {
  tenantId: string;
  sessionId: string;
  billingType?: 'PIX' | 'UNDEFINED' | 'BOLETO' | 'CREDIT_CARD';
  paymentLinkName?: string;
  paymentLinkDescription?: string;
}

@Injectable()
export class CheckoutShoppingSessionUseCase {
  private readonly logger = new Logger(CheckoutShoppingSessionUseCase.name);

  constructor(
    @Inject(COMMERCE_REPOSITORY)
    private readonly commerceRepository: ICommerceRepository,
    @Inject(PAYMENT_FACADE)
    private readonly paymentFacade: IPaymentFacade,
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

    const sessionAggregate = ShoppingSession.reconstruct({
      id: session.id,
      tenantId: session.tenantId,
      branchId: session.branchId,
      conversationId: session.conversationId,
      contactId: session.contactId,
      status: session.status,
      fulfillmentType: session.fulfillmentType,
      deliveryAddress: session.deliveryAddress,
      couponCode: session.couponCode,
      subtotalAmount: session.subtotalAmount ?? 0,
      freightAmount: session.freightAmount ?? 0,
      discountAmount: session.discountAmount ?? 0,
      totalAmount: session.totalAmount ?? 0,
      items: session.items.map((item) => ({
        id: item.id,
        sessionId: item.sessionId,
        tenantId: item.tenantId,
        source: item.source,
        inventoryItemId: item.inventoryItemId,
        catalogItemId: item.catalogItemId,
        name: item.name,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice ?? 0),
        lineTotal: Number(item.lineTotal),
        currency: item.currency,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
    });

    if (session.items.length === 0) {
      throw new ConflictException('Add at least one item before checkout');
    }

    if (!session.fulfillmentType) {
      throw new BadRequestException(
        'Select pickup or delivery before checkout',
      );
    }

    // Carrier shipping ships to the customer's CEP (postal code); a full street
    // address is not collected in the conversational carrier flow, so a present
    // carrierCep satisfies the delivery-target requirement.
    const hasCarrierTarget =
      session.shippingMode === 'CARRIER' && !!session.carrierCep?.trim();

    if (
      session.fulfillmentType === 'DELIVERY' &&
      !session.deliveryAddress?.trim() &&
      !hasCarrierTarget
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

    // COM3 fix: atomically claim the session for checkout.
    // Only one concurrent request can transition BUILDING_CART → CHECKING_OUT.
    const claimed = await this.commerceRepository.atomicTransitionToCheckingOut(
      input.tenantId,
      input.sessionId,
    );
    if (!claimed) {
      throw new SessionAlreadyProcessingException(input.sessionId);
    }

    const { subtotal, freight, discount, total } =
      sessionAggregate.computeCheckoutTotals();

    // COM2 fix: checkout-time authoritative stock decrement.
    // Only inventory-backed items carry physical stock.
    const inventoryItems = session.items
      .filter((i) => i.source === 'INVENTORY' && i.inventoryItemId)
      .map((i) => ({
        inventoryItemId: i.inventoryItemId as string,
        quantity: i.quantity,
      }));

    if (inventoryItems.length > 0) {
      await this.commerceRepository.decrementStockForCheckout(
        input.tenantId,
        inventoryItems,
      );
    }

    const orderId = randomUUID();
    const paymentReference = buildCommercePaymentReference({
      tenantId: input.tenantId,
      orderId,
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
      subtotalAmount: subtotal.amount,
      freightAmount: freight.amount,
      totalAmount: total.amount,
      deliveryAddress: session.deliveryAddress,
      paymentReference,
      paymentLinkId: null,
      paymentLinkUrl: null,
      paymentStatus: 'PENDING',
      couponCode: session.couponCode,
      discountAmount: discount.amount,
      carrierServiceName: session.carrierServiceName,
    });

    let paymentLink: { id: string; url: string };
    try {
      paymentLink = await this.paymentFacade.createPaymentLink({
        name:
          input.paymentLinkName?.trim() ||
          `Pedido ${orderId.slice(0, 8).toUpperCase()}`,
        description:
          input.paymentLinkDescription?.trim() ||
          `Checkout conversacional da sessão ${session.id}`,
        value: total.amount,
        externalReference: paymentReference,
        billingType: input.billingType ?? 'PIX',
        chargeType: 'DETACHED',
        dueDateLimitDays: 1,
      });
    } catch (error) {
      this.logger.error(
        {
          tenantId: input.tenantId,
          orderId,
          err: error instanceof Error ? error.message : String(error),
        },
        'Payment link creation failed — cancelling order',
      );
      await this.commerceRepository.updateOrderStatus({
        tenantId: input.tenantId,
        orderId,
        status: 'CANCELLED',
      });
      await this.commerceRepository.saveAuditLog({
        tenantId: input.tenantId,
        event: 'CHECKOUT_PAYMENT_LINK_FAILED',
        entityId: orderId,
        entityType: 'ORDER',
        metadata: {
          sessionId: session.id,
          total: total.amount,
        },
      });
      throw error;
    }

    const orderWithLink = await this.commerceRepository.updateOrderPaymentLink({
      tenantId: input.tenantId,
      orderId,
      paymentLinkId: paymentLink.id,
      paymentLinkUrl: paymentLink.url,
    });

    const updatedSession = await this.commerceRepository.updateSessionState({
      tenantId: input.tenantId,
      sessionId: session.id,
      status: 'AWAITING_PAYMENT',
      currentStep: 'AWAITING_PAYMENT',
      subtotalAmount: subtotal.amount,
      discountAmount: discount.amount,
      totalAmount: total.amount,
      paymentReference,
      paymentLinkId: paymentLink.id,
      paymentLinkUrl: paymentLink.url,
      paymentStatus: 'PENDING',
      checkedOutAt: new Date(),
    });

    await this.commerceRepository.saveAuditLog({
      tenantId: input.tenantId,
      event: 'CHECKOUT_CREATED',
      entityId: orderWithLink.id,
      entityType: 'ORDER',
      metadata: {
        sessionId: session.id,
        total: total.amount,
      },
    });

    await this.eventBus.publish(
      new CommerceCheckoutCreatedIntegrationEvent({
        orderId: orderWithLink.id,
        tenantId: orderWithLink.tenantId,
        sessionId: session.id,
        conversationId: orderWithLink.conversationId,
        contactId: orderWithLink.contactId,
        paymentReference: orderWithLink.paymentReference,
        paymentLinkId: orderWithLink.paymentLinkId,
        paymentLinkUrl: orderWithLink.paymentLinkUrl,
        fulfillmentType: orderWithLink.fulfillmentType,
        shippingMode: orderWithLink.shippingMode,
        subtotalAmount: orderWithLink.subtotalAmount,
        freightAmount: orderWithLink.freightAmount,
        totalAmount: orderWithLink.totalAmount,
      }),
    );

    return {
      order: orderWithLink,
      session: updatedSession,
      paymentLink,
    };
  }
}
