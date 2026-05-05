import { Inject, Injectable } from '@nestjs/common';
import {
  ISalesPaymentLinksRepository,
  SALES_PAYMENT_LINKS_REPOSITORY,
} from '../../domain/repositories/ISalesRepository';
import { ListPaymentLinksInput } from './ListPaymentLinksUseCase';

@Injectable()
export class GenerateSalesPaymentLinksReportUseCase {
  constructor(
    @Inject(SALES_PAYMENT_LINKS_REPOSITORY)
    private readonly salesRepository: ISalesPaymentLinksRepository,
  ) {}

  async execute(input: ListPaymentLinksInput) {
    return this.salesRepository.listPaymentLinks(input.tenantId, {
      page: 1,
      pageSize: 10000,
      search: input.search,
      status: input.status ?? 'ALL',
      source: input.source ?? 'ALL',
      branchId: input.branchId ?? null,
      dateFrom: input.dateFrom ?? null,
      dateTo: input.dateTo ?? null,
    });
  }
}
