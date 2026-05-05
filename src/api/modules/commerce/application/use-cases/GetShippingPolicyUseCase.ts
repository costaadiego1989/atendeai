import { Inject, Injectable } from '@nestjs/common';
import {
  COMMERCE_REPOSITORY,
  ICommerceRepository,
} from '../../domain/ports/ICommerceRepository';

@Injectable()
export class GetShippingPolicyUseCase {
  constructor(
    @Inject(COMMERCE_REPOSITORY)
    private readonly commerceRepository: ICommerceRepository,
  ) {}

  async execute(tenantId: string) {
    return this.commerceRepository.findShippingPolicyByTenantId(tenantId);
  }
}
