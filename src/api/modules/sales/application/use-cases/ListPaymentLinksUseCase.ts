import { Inject, Injectable } from '@nestjs/common';
import {
  ISalesPaymentLinksRepository,
  SALES_PAYMENT_LINKS_REPOSITORY,
} from '../../domain/repositories/ISalesRepository';

export interface ListPaymentLinksInput {
  tenantId: string;
  branchId?: string | null;
  page?: number;
  pageSize?: number;
  search?: string;
  status?:
    | 'ALL'
    | 'ACTIVE'
    | 'PAUSED'
    | 'DELETED'
    | 'PAID'
    | 'OVERDUE'
    | 'REFUNDED'
    | 'EXPIRED';
  source?: 'ALL' | 'MANUAL' | 'AI';
  dateFrom?: Date | null;
  dateTo?: Date | null;
}

@Injectable()
export class ListPaymentLinksUseCase {
  constructor(
    @Inject(SALES_PAYMENT_LINKS_REPOSITORY)
    private readonly salesRepository: ISalesPaymentLinksRepository,
  ) {}

  async execute(input: ListPaymentLinksInput) {
    const page = Math.max(1, input.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 20));

    const result = await this.salesRepository.listPaymentLinks(input.tenantId, {
      page,
      pageSize,
      search: input.search,
      status: input.status ?? 'ALL',
      source: input.source ?? 'ALL',
      branchId: input.branchId ?? null,
      dateFrom: input.dateFrom ?? null,
      dateTo: input.dateTo ?? null,
    });

    return {
      items: result.items.map((item) => ({
        id: item.id,
        branchId: item.branchId ?? undefined,
        name: item.name,
        description: item.description ?? undefined,
        label: item.label ?? undefined,
        value: item.value,
        url: item.url,
        billingType: item.billingType,
        status: item.status,
        source: item.source,
        resourceType: item.resourceType ?? 'PAYMENT_LINK',
        contactId: item.contactId ?? undefined,
        contactName: item.contactName ?? undefined,
        conversationId: item.conversationId ?? undefined,
        expiresAt: item.expiresAt?.toISOString(),
        recurrenceEnabled: item.recurrenceEnabled ?? false,
        recurrenceFrequency: item.recurrenceFrequency ?? undefined,
        recurrenceStartDate: item.recurrenceStartDate?.toISOString(),
        recurrenceEndDate: item.recurrenceEndDate?.toISOString(),
        recurrenceTotalValue: item.recurrenceTotalValue ?? undefined,
        recurrenceNextRunAt: item.recurrenceNextRunAt?.toISOString(),
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      })),
      pagination: {
        page,
        pageSize,
        total: result.total,
        totalPages: Math.max(1, Math.ceil(result.total / pageSize)),
      },
      summary: result.summary,
    };
  }
}
