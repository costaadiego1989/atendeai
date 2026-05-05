import { Injectable } from '@nestjs/common';
import { GenerateContactsReportOutput } from '../use-cases/interfaces/IGenerateContactsReportUseCase';

@Injectable()
export class ContactReportCsvBuilder {
  build(report: GenerateContactsReportOutput): {
    fileName: string;
    mimeType: string;
    content: string;
  } {
    const rows = [
      [
        'Nome',
        'Telefone',
        'Documento',
        'Email',
        'Estagio',
        'Tags',
        'Ultima interação',
        'Ultimo evento',
        'Eventos',
        'Inbound',
        'Outbound',
        'Canais',
        'Tipos timeline',
      ],
      ...report.contacts.map((contact) => [
        contact.name,
        contact.phone,
        contact.document ?? '',
        contact.email ?? '',
        contact.stage,
        (contact.tags ?? []).join(' | '),
        contact.lastInteraction?.toISOString() ?? '',
        contact.lastTimelineEventAt?.toISOString() ?? '',
        String(contact.timelineEventCount),
        String(contact.inboundMessages),
        String(contact.outboundMessages),
        (contact.channels ?? []).join(' | '),
        (contact.timelineTypes ?? []).join(' | '),
      ]),
    ];

    const content = rows
      .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(';'))
      .join('\n');

    return {
      fileName: `relatorio-contatos-${new Date().toISOString().slice(0, 10)}.csv`,
      mimeType: 'text/csv;charset=utf-8',
      content,
    };
  }
}
