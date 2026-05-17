import { Injectable } from '@nestjs/common';
import { GenerateInventoryReportOutput } from '../use-cases/GenerateInventoryReportUseCase';

@Injectable()
export class InventoryReportCsvBuilder {
  build(report: GenerateInventoryReportOutput): {
    fileName: string;
    mimeType: string;
    content: string;
  } {
    const rows = [
      [
        'Nome',
        'SKU',
        'referência externa',
        'Quantidade',
        'Status',
        'preço atual',
        'Moeda',
        'Origem',
        'Catalog item',
        'Ultimo sync',
      ],
      ...report.items.map((item) => [
        item.name,
        item.sku,
        item.externalReference ?? '',
        String(item.availableQuantity),
        item.availabilityStatus,
        item.currentPrice ?? '',
        item.currency,
        item.source,
        item.catalogItemId ?? '',
        item.lastSyncedAt.toISOString(),
      ]),
    ];

    return {
      fileName: `relatorio-estoque-${new Date().toISOString().slice(0, 10)}.csv`,
      mimeType: 'text/csv;charset=utf-8',
      content: rows
        .map((row) =>
          row
            .map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`)
            .join(';'),
        )
        .join('\n'),
    };
  }
}
