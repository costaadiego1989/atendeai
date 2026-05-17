import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  COMMERCE_REPOSITORY,
  ICommerceRepository,
} from '../../domain/ports/ICommerceRepository';

@Injectable()
export class GetCommerceOrderDetailsUseCase {
  constructor(
    @Inject(COMMERCE_REPOSITORY)
    private readonly commerceRepository: ICommerceRepository,
  ) {}

  async execute(tenantId: string, orderId: string) {
    const order = await this.commerceRepository.findOrderById(
      tenantId,
      orderId,
    );

    if (!order) {
      throw new NotFoundException('Commerce order not found');
    }

    const session = await this.commerceRepository.findSessionById(
      tenantId,
      order.sessionId,
    );
    const abandonmentTouches =
      await this.commerceRepository.listSessionAbandonmentTouches(
        tenantId,
        order.sessionId,
      );

    return {
      order,
      session,
      abandonmentTouches,
    };
  }
}
