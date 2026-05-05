import { Injectable } from '@nestjs/common';
import { SalesPaymentLinkRecord } from '../../domain/repositories/ISalesRepository';

export interface SalesPaymentLinksReportFilter {
  dateFrom?: Date | null;
  dateTo?: Date | null;
}

@Injectable()
export class SalesPaymentLinksReportCsvBuilder {
  build(
    items: SalesPaymentLinkRecord[],
    filters: SalesPaymentLinksReportFilter = {},
  ): string {
    const rows = [
      [
        'Cobrança',
        'Contato',
        'Status',
        'Origem',
        'Tipo',
        'Pagamento',
        'Valor',
        'Recorrente',
        'Frequencia',
        'Inicio recorrência',
        'Fim recorrência',
        'Total recorrência',
        'Proxima execucao',
        'Vencimento',
        'Criado em',
        'Atualizado em',
        'URL',
        'Inicio filtro',
        'Fim filtro',
      ],
      ...items.map((item) => [
        item.name,
        item.contactName ?? '',
        item.status,
        item.source,
        item.resourceType ?? 'PAYMENT_LINK',
        item.billingType,
        this.formatMoney(item.value),
        item.recurrenceEnabled ? 'Sim' : 'Nao',
        item.recurrenceFrequency ?? '',
        this.formatDate(item.recurrenceStartDate),
        this.formatDate(item.recurrenceEndDate),
        this.formatMoney(item.recurrenceTotalValue),
        this.formatDate(item.recurrenceNextRunAt),
        this.formatDate(item.expiresAt),
        this.formatDate(item.createdAt),
        this.formatDate(item.updatedAt),
        item.url,
        this.formatDate(filters.dateFrom),
        this.formatDate(filters.dateTo),
      ]),
    ];

    return rows.map((row) => row.map((value) => this.escape(value)).join(';')).join('\n');
  }

  private escape(value: unknown): string {
    return `"${String(value ?? '').replace(/"/g, '""')}"`;
  }

  private formatMoney(value: number | string | null | undefined): string {
    return Number(value ?? 0).toFixed(2).replace('.', ',');
  }

  private formatDate(value?: Date | string | null): string {
    if (!value) {
      return '';
    }

    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString();
  }
}
