import { Inject, Injectable } from '@nestjs/common';
import {
  COMMERCE_REPOSITORY,
  ICommerceRepository,
} from '../../domain/ports/ICommerceRepository';

export interface ListCommerceOrdersInput {
  tenantId: string;
  branchId?: string | null;
  status?: string | null;
  paymentStatus?: string | null;
  dateFrom?: Date | null;
  dateTo?: Date | null;
}

@Injectable()
export class ListCommerceOrdersUseCase {
  constructor(
    @Inject(COMMERCE_REPOSITORY)
    private readonly commerceRepository: ICommerceRepository,
  ) {}

  async execute(input: ListCommerceOrdersInput) {
    return this.commerceRepository.listOrders(input);
  }
}
