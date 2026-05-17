import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  COMMERCE_REPOSITORY,
  ICommerceRepository,
} from '../../domain/ports/ICommerceRepository';

@Injectable()
export class GetShoppingSessionUseCase {
  constructor(
    @Inject(COMMERCE_REPOSITORY)
    private readonly commerceRepository: ICommerceRepository,
  ) {}

  async execute(tenantId: string, sessionId: string) {
    const session = await this.commerceRepository.findSessionById(
      tenantId,
      sessionId,
    );

    if (!session) {
      throw new NotFoundException('Shopping session not found');
    }

    return session;
  }
}
