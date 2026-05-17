import PDFDocument = require('pdfkit');
import { Inject } from '@nestjs/common';
import { IProposalRepository } from '@modules/proposal/domain/ports/IProposalRepository';
import {
  FILE_STORAGE_SERVICE,
  FileStorageService,
} from '@shared/domain/services/FileStorageService';
import { ProposalNotFoundError } from '@modules/proposal/domain/errors/ProposalNotFoundError';

export class GenerateProposalPdfUseCase {
  constructor(
    @Inject('IProposalRepository')
    private readonly proposalRepository: IProposalRepository,
    @Inject(FILE_STORAGE_SERVICE)
    private readonly storageService: FileStorageService,
  ) {}

  async execute(proposalId: string): Promise<string> {
    const proposal = await this.proposalRepository.findById(proposalId);
    if (!proposal) throw new ProposalNotFoundError(proposalId);

    const pdfBuffer = await this.generatePdfBuffer(proposal);
    const fileName = `proposal-${proposal.id}.pdf`;

    const pdfUrl = await this.storageService.upload(
      pdfBuffer,
      fileName,
      'application/pdf',
      { folder: 'proposals' },
    );

    proposal.setPdfUrl(pdfUrl);
    await this.proposalRepository.update(proposal);

    return pdfUrl;
  }

  private async generatePdfBuffer(proposal: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const buffers: Buffer[] = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      doc.fontSize(25).text('ORÇAMENTO COMERCIAL', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`ID: ${proposal.id}`, { align: 'right' });
      doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, {
        align: 'right',
      });
      doc.moveDown();

      doc.fontSize(18).fillColor('#2c3e50').text(proposal.title);
      doc.moveDown(0.5);
      doc
        .fontSize(12)
        .fillColor('black')
        .text(proposal.description || '');
      doc.moveDown();

      if (proposal.benefits) {
        doc
          .fontSize(14)
          .fillColor('#27ae60')
          .text('Diferenciais e Benefícios:');
        doc.fontSize(12).fillColor('black').text(proposal.benefits);
        doc.moveDown();
      }

      doc.fontSize(14).fillColor('#2c3e50').text('Itens do Orçamento:');
      doc.moveDown(0.5);

      const tableTop = doc.y;
      doc.fontSize(10).fillColor('grey');
      doc.text('Item', 50, tableTop);
      doc.text('Qtd', 350, tableTop);
      doc.text('V. Unitário', 400, tableTop);
      doc.text('Subtotal', 500, tableTop);

      doc
        .moveTo(50, tableTop + 15)
        .lineTo(550, tableTop + 15)
        .stroke();

      let currentY = tableTop + 25;
      doc.fillColor('black');

      proposal.items.forEach((item: any) => {
        doc.text(item.name, 50, currentY);
        doc.text(item.quantity.toString(), 350, currentY);
        doc.text(`R$ ${item.unitPrice.toFixed(2)}`, 400, currentY);
        doc.text(
          `R$ ${(item.unitPrice * item.quantity).toFixed(2)}`,
          500,
          currentY,
        );
        currentY += 20;
      });

      doc.moveTo(50, currentY).lineTo(550, currentY).stroke();
      doc.moveDown();

      doc
        .fontSize(16)
        .fillColor('#2c3e50')
        .text(`VALOR TOTAL: R$ ${proposal.totalAmount.toFixed(2)}`, {
          align: 'right',
        });

      doc.end();
    });
  }
}
