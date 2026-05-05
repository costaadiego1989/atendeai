import { Injectable } from '@nestjs/common';
import { CommerceOrderListItemRecord } from '../../domain/ports/ICommerceRepository';

export interface CommerceOrdersReportFilter {
  dateFrom?: Date | null;
  dateTo?: Date | null;
}

@Injectable()
export class CommerceOrdersReportCsvBuilder {
  build(
    orders: CommerceOrderListItemRecord[],
    filters: CommerceOrdersReportFilter = {},
  ): string {
    const rows = [
      [
        'Pedido',
        'Cliente',
        'Telefone',
        'Status',
        'Pagamento',
        'Atendimento',
        'Subtotal',
        'Frete',
        'Total',
        'Referencia pagamento',
        'Criado em',
        'Atualizado em',
        'Inicio filtro',
        'Fim filtro',
      ],
      ...orders.map((order) => [
        order.id,
        order.contactName ?? '',
        order.contactPhone ?? '',
        order.status,
        order.paymentStatus ?? '',
        order.fulfillmentType ?? '',
        this.formatMoney(order.subtotalAmount),
        this.formatMoney(order.freightAmount),
        this.formatMoney(order.totalAmount),
        order.paymentReference ?? '',
        this.formatDate(order.createdAt),
        this.formatDate(order.updatedAt),
        this.formatDate(filters.dateFrom),
        this.formatDate(filters.dateTo),
      ]),
    ];

    return rows.map((row) => row.map((value) => this.escape(value)).join(';')).join('\n');
  }

  private escape(value: unknown): string {
    const text = String(value ?? '');
    return `"${text.replace(/"/g, '""')}"`;
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
