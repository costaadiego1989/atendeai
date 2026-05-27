import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  COMMERCE_REPOSITORY,
  ICommerceRepository,
} from '../../domain/ports/ICommerceRepository';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import { CommerceSessionItemAddedIntegrationEvent } from '../integration-events/CheckoutIntegrationEvents';
import {
  SALES_FACADE,
  ISalesFacade,
} from '@modules/sales/application/facades/ISalesFacade';
import { ShoppingSession } from '../../domain/entities/ShoppingSession';
import { Money } from '../../domain/value-objects/Money';

export interface AddItemToShoppingSessionInput {
  tenantId: string;
  sessionId: string;
  catalogItemId?: string;
  inventoryItemId?: string;
  quantity: number;
}

@Injectable()
export class AddItemToShoppingSessionUseCase {
  constructor(
    @Inject(COMMERCE_REPOSITORY)
    private readonly commerceRepository: ICommerceRepository,
    @Inject(SALES_FACADE)
    private readonly salesFacade: ISalesFacade,
    @Inject(EVENT_BUS)
    private readonly eventBus: IEventBus,
  ) {}

  async execute(input: AddItemToShoppingSessionInput) {
    if (!input.catalogItemId && !input.inventoryItemId) {
      throw new BadRequestException('Select an inventory or catalog item');
    }

    if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
      throw new BadRequestException('Quantity must be greater than zero');
    }

    const session = await this.commerceRepository.findSessionById(
      input.tenantId,
      input.sessionId,
    );

    if (!session) {
      throw new NotFoundException('Shopping session not found');
    }

    let name = '';
    let price: number | null = null;
    let currency = 'BRL';
    let source: 'INVENTORY' | 'CATALOG' = 'CATALOG';
    let catalogItemId = input.catalogItemId ?? null;
    const inventoryItemId = input.inventoryItemId ?? null;

    if (input.inventoryItemId) {
      const inventoryItem = await this.commerceRepository.findInventoryItemById(
        input.tenantId,
        input.inventoryItemId,
      );

      if (!inventoryItem) {
        throw new NotFoundException('Inventory item not found');
      }

      if (
        inventoryItem.availabilityStatus === 'UNAVAILABLE' ||
        inventoryItem.availableQuantity <= 0
      ) {
        throw new ConflictException('Selected item is not available');
      }

      name = inventoryItem.name;
      price = inventoryItem.currentPrice;
      currency = inventoryItem.currency;
      source = 'INVENTORY';
      catalogItemId = inventoryItem.catalogItemId;
    } else if (input.catalogItemId) {
      const catalogItem = await this.commerceRepository.findCatalogItemById(
        input.tenantId,
        input.catalogItemId,
      );

      if (!catalogItem) {
        throw new NotFoundException('Catalog item not found');
      }

      name = catalogItem.name;
      price = catalogItem.basePrice;
      currency = catalogItem.currency;
      source = 'CATALOG';
    }

    if (price == null || price <= 0) {
      throw new ConflictException('Selected item has no valid price');
    }

    const lineTotal = ShoppingSession.computeLineTotal(
      price,
      input.quantity,
      currency,
    );

    const addedItem = await this.commerceRepository.addSessionItem({
      sessionId: input.sessionId,
      tenantId: input.tenantId,
      source,
      inventoryItemId,
      catalogItemId,
      name,
      quantity: input.quantity,
      unitPrice: price,
      lineTotal: lineTotal.amount,
      currency,
    });

    const refreshedSession = await this.commerceRepository.findSessionById(
      input.tenantId,
      input.sessionId,
    );

    if (!refreshedSession) {
      throw new NotFoundException('Shopping session not found after item add');
    }

    const sessionAggregate = ShoppingSession.reconstruct({
      id: refreshedSession.id,
      tenantId: refreshedSession.tenantId,
      branchId: refreshedSession.branchId,
      conversationId: refreshedSession.conversationId,
      contactId: refreshedSession.contactId,
      status: refreshedSession.status,
      fulfillmentType: refreshedSession.fulfillmentType,
      deliveryAddress: refreshedSession.deliveryAddress,
      couponCode: refreshedSession.couponCode,
      subtotalAmount: refreshedSession.subtotalAmount ?? 0,
      freightAmount: refreshedSession.freightAmount ?? 0,
      discountAmount: refreshedSession.discountAmount ?? 0,
      totalAmount: refreshedSession.totalAmount ?? 0,
      currency,
      items: refreshedSession.items.map((item) => ({
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

    // Recalculate subtotal from items first (DB value may be stale)
    sessionAggregate.recalculateTotals();

    let discountOverride: Money | undefined;
    if (refreshedSession.couponCode) {
      const coupon = await this.salesFacade.findCouponByCode(
        input.tenantId,
        refreshedSession.couponCode,
      );
      if (coupon && coupon.active) {
        if (coupon.discountType === 'FIXED_AMOUNT') {
          discountOverride = Money.create(coupon.discountValue, currency);
        } else if (coupon.discountType === 'PERCENTAGE') {
          const subtotal = sessionAggregate.subtotalAmount;
          discountOverride = subtotal.multiply(coupon.discountValue / 100);
        }
      }
    }

    if (discountOverride) {
      sessionAggregate.recalculateTotals(discountOverride);
    }

    const updatedSession = await this.commerceRepository.updateSessionState({
      tenantId: input.tenantId,
      sessionId: input.sessionId,
      status: 'BUILDING_CART',
      subtotalAmount: sessionAggregate.subtotalAmount.amount,
      discountAmount: sessionAggregate.discountAmount.amount,
      totalAmount: sessionAggregate.totalAmount.amount,
    });

    await this.eventBus.publish(
      new CommerceSessionItemAddedIntegrationEvent({
        tenantId: input.tenantId,
        sessionId: updatedSession.id,
        conversationId: updatedSession.conversationId,
        contactId: updatedSession.contactId,
        itemName: addedItem.name,
        quantity: addedItem.quantity,
        unitPrice: Number(addedItem.unitPrice ?? 0),
        lineTotal: Number(addedItem.lineTotal),
        subtotalAmount: updatedSession.subtotalAmount,
        totalAmount: updatedSession.totalAmount,
        source: addedItem.source,
        inventoryItemId: addedItem.inventoryItemId,
        catalogItemId: addedItem.catalogItemId,
      }),
    );

    return updatedSession;
  }
}
