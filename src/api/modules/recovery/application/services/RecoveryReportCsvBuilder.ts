import { Injectable } from '@nestjs/common';
import { GenerateRecoveryReportOutput } from '../use-cases/GenerateRecoveryReportUseCase';

@Injectable()
export class RecoveryReportCsvBuilder {
  build(report: GenerateRecoveryReportOutput): {
    fileName: string;
    mimeType: string;
    content: string;
  } {
    const rows = [
      [
        'Devedor',
        'Empresa',
        'Telefone',
        'Origem',
        'Status',
        'título',
        'Descrição',
        'Valor',
        'Vencimento',
        'referência externa',
        'referência pagamento',
        'Tags',
        'Ultimo contato',
        'Proxima ação',
        'Pago em',
        'Criado em',
        'Atualizado em',
      ],
      ...report.items.map((item) => [
        item.debtorName,
        item.debtorCompanyName ?? '',
        item.phone,
        item.source,
        item.status,
        item.chargeTitle ?? '',
        item.chargeDescription ?? '',
        item.amountDue ?? '',
        item.dueDate ? item.dueDate.toISOString() : '',
        item.externalReference ?? '',
        item.paymentReference ?? '',
        item.assignedTags.join(', '),
        item.lastContactedAt ? item.lastContactedAt.toISOString() : '',
        item.nextActionAt ? item.nextActionAt.toISOString() : '',
        item.paidAt ? item.paidAt.toISOString() : '',
        item.createdAt.toISOString(),
        item.updatedAt.toISOString(),
      ]),
    ];

    return {
      fileName: `relatorio-cobranças-${new Date().toISOString().slice(0, 10)}.csv`,
      mimeType: 'text/csv;charset=utf-8',
      content: rows
        .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(';'))
        .join('\n'),
    };
  }
}
