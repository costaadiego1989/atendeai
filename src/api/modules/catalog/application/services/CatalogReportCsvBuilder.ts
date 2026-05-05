import { Injectable } from '@nestjs/common';
import { GenerateCatalogReportOutput } from '../use-cases/GenerateCatalogReportUseCase';

@Injectable()
export class CatalogReportCsvBuilder {
  build(report: GenerateCatalogReportOutput): {
    fileName: string;
    mimeType: string;
    content: string;
  } {
    const rows = [
      [
        'Nome',
        'Tipo',
        'Categoria',
        'Ativo',
        'preço base',
        'Moeda',
        'Origem',
        'referência externa',
        'Tags',
        'Descrição',
        'Criado em',
        'Atualizado em',
      ],
      ...report.items.map((item) => [
        item.name,
        item.type,
        item.categoryName ?? '',
        item.active ? 'Sim' : 'não',
        item.basePrice ?? '',
        item.currency,
        item.source,
        item.externalReference ?? '',
        item.tags.join(', '),
        item.description ?? '',
        item.createdAt.toISOString(),
        item.updatedAt.toISOString(),
      ]),
    ];

    return {
      fileName: `relatorio-catalogo-${new Date().toISOString().slice(0, 10)}.csv`,
      mimeType: 'text/csv;charset=utf-8',
      content: rows
        .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(';'))
        .join('\n'),
    };
  }
}
