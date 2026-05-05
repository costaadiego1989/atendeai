import { Injectable } from '@nestjs/common';
import { GenerateSchedulingReportOutput } from '../use-cases/GenerateSchedulingReportUseCase';

@Injectable()
export class SchedulingReportCsvBuilder {
  build(report: GenerateSchedulingReportOutput): {
    fileName: string;
    mimeType: string;
    content: string;
  } {
    const rows = [
      [
        'Data',
        'Profissional',
        'Inicio',
        'Fim',
        'Status',
        'Categoria',
        'Contato',
        'Telefone',
        'Valor',
        'Pagamento',
        'referência pagamento',
        'Observações',
        'Label',
      ],
      ...report.rows.map((row) => [
        row.date,
        row.professionalName,
        row.startsAt,
        row.endsAt,
        row.status,
        row.categoryName ?? '',
        row.contactName ?? '',
        row.contactPhone ?? '',
        row.resolvedPrice != null ? String(row.resolvedPrice) : '',
        row.paymentStatus ?? '',
        row.paymentReference ?? '',
        row.notes ?? '',
        row.label ?? '',
      ]),
    ];

    return {
      fileName: `relatorio-agenda-${new Date().toISOString().slice(0, 10)}.csv`,
      mimeType: 'text/csv;charset=utf-8',
      content: rows
        .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(';'))
        .join('\n'),
    };
  }
}
