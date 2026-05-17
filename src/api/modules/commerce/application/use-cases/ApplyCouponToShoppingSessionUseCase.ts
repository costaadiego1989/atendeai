import {
  Inject,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  COMMERCE_REPOSITORY,
  ICommerceRepository,
} from '../../domain/ports/ICommerceRepository';
import {
  SALES_REPOSITORY,
  ISalesCouponRepository,
} from '@modules/sales/domain/repositories/ISalesRepository';

export interface ApplyCouponToShoppingSessionInput {
  tenantId: string;
  sessionId: string;
  code: string;
}

@Injectable()
export class ApplyCouponToShoppingSessionUseCase {
  constructor(
    @Inject(COMMERCE_REPOSITORY)
    private readonly commerceRepository: ICommerceRepository,
    @Inject(SALES_REPOSITORY)
    private readonly salesRepository: ISalesCouponRepository,
  ) {}

  async execute(input: ApplyCouponToShoppingSessionInput) {
    const session = await this.commerceRepository.findSessionById(
      input.tenantId,
      input.sessionId,
    );
    if (!session) {
      throw new NotFoundException('Shopping session not found');
    }

    const coupon = await this.salesRepository.findCouponByCode(
      input.tenantId,
      input.code,
    );
    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }

    if (!coupon.active) {
      throw new BadRequestException('Coupon is inactive');
    }

    const now = new Date();
    if (now < coupon.startsAt) {
      throw new BadRequestException('Coupon has not started yet');
    }
    if (coupon.expiresAt && now > coupon.expiresAt) {
      throw new BadRequestException('Coupon has expired');
    }

    if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) {
      throw new BadRequestException('Coupon usage limit reached');
    }

    if (coupon.minimumOrder && session.subtotalAmount < coupon.minimumOrder) {
      throw new BadRequestException(
        `Minimum order amount of BRL ${coupon.minimumOrder} not met`,
      );
    }

    let discountAmount = 0;
    if (coupon.discountType === 'FIXED_AMOUNT') {
      discountAmount = coupon.discountValue;
    } else if (coupon.discountType === 'PERCENTAGE') {
      discountAmount = (session.subtotalAmount * coupon.discountValue) / 100;
    }

    const totalAmount =
      session.subtotalAmount + (session.freightAmount ?? 0) - discountAmount;

    return await this.commerceRepository.updateSessionState({
      tenantId: input.tenantId,
      sessionId: input.sessionId,
      couponCode: coupon.code,
      discountAmount,
      totalAmount,
    });
  }
}
