import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  COMMERCE_REPOSITORY,
  CommerceShippingPolicyRecord,
  ICommerceRepository,
} from '../../domain/ports/ICommerceRepository';

import { SALES_REPOSITORY, ISalesCouponRepository } from '@modules/sales/domain/repositories/ISalesRepository';

export interface UpdateShoppingSessionFulfillmentInput {
  tenantId: string;
  sessionId: string;
  fulfillmentType: 'PICKUP' | 'DELIVERY';
  distanceKm?: number | null;
  deliveryAddress?: string | null;
  notes?: string | null;
}

@Injectable()
export class UpdateShoppingSessionFulfillmentUseCase {
  constructor(
    @Inject(COMMERCE_REPOSITORY)
    private readonly commerceRepository: ICommerceRepository,
    @Inject(SALES_REPOSITORY)
    private readonly salesRepository: ISalesCouponRepository,
  ) {}

  async execute(input: UpdateShoppingSessionFulfillmentInput) {
    const session = await this.commerceRepository.findSessionById(
      input.tenantId,
      input.sessionId,
    );

    if (!session) {
      throw new NotFoundException('Shopping session not found');
    }

    const subtotalAmount = session.items.reduce(
      (total, item) => total + Number(item.lineTotal),
      0,
    );

    if (input.fulfillmentType === 'PICKUP') {
      const discountAmount = await this.getDiscountAmount(
        input.tenantId,
        session.couponCode,
        subtotalAmount,
      );

      return this.commerceRepository.updateSessionState({
        tenantId: input.tenantId,
        sessionId: input.sessionId,
        status: 'READY_FOR_CHECKOUT',
        currentStep: 'READY_FOR_CHECKOUT',
        fulfillmentType: 'PICKUP',
        shippingMode: null,
        distanceKm: null,
        freightAmount: 0,
        deliveryAddress: null,
        notes: input.notes ?? null,
        subtotalAmount,
        discountAmount,
        totalAmount: subtotalAmount - discountAmount,
      });
    }

    const shippingPolicy = await this.commerceRepository.findShippingPolicyByTenantId(
      input.tenantId,
    );

    if (!shippingPolicy || !shippingPolicy.active) {
      throw new ConflictException('Configure an active shipping policy before delivery');
    }

    if (!input.deliveryAddress?.trim()) {
      throw new BadRequestException('Delivery address is required');
    }

    const freightAmount = this.calculateFreight(shippingPolicy, input.distanceKm ?? null);

    const discountAmount = await this.getDiscountAmount(
      input.tenantId,
      session.couponCode,
      subtotalAmount,
    );

    return this.commerceRepository.updateSessionState({
      tenantId: input.tenantId,
      sessionId: input.sessionId,
      status: 'READY_FOR_CHECKOUT',
      currentStep: 'READY_FOR_CHECKOUT',
      fulfillmentType: 'DELIVERY',
      shippingMode: shippingPolicy.mode,
      distanceKm: input.distanceKm ?? null,
      freightAmount,
      deliveryAddress: input.deliveryAddress.trim(),
      notes: input.notes ?? null,
      subtotalAmount,
      discountAmount,
      totalAmount: subtotalAmount + freightAmount - discountAmount,
    });
  }

  private async getDiscountAmount(
    tenantId: string,
    couponCode: string | null,
    subtotal: number,
  ): Promise<number> {
    if (!couponCode) return 0;

    const coupon = await this.salesRepository.findCouponByCode(tenantId, couponCode);
    if (!coupon || !coupon.active) return 0;

    if (coupon.discountType === 'FIXED_AMOUNT') {
      return coupon.discountValue;
    } else if (coupon.discountType === 'PERCENTAGE') {
      return (subtotal * coupon.discountValue) / 100;
    }

    return 0;
  }

  private calculateFreight(
    policy: CommerceShippingPolicyRecord,
    distanceKm: number | null,
  ) {
    if (policy.mode === 'FIXED') {
      return Number(policy.fixedAmount ?? 0);
    }

    if (distanceKm == null || distanceKm < 0) {
      throw new BadRequestException('Distance in km is required for per-km shipping');
    }

    const calculated = Number(policy.pricePerKm ?? 0) * Number(distanceKm);
    const minimumAmount = Number(policy.minimumAmount ?? 0);
    return Math.max(minimumAmount, Number(calculated.toFixed(2)));
  }
}
