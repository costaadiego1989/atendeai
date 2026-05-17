import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ProcessDocumentForRAGUseCase } from '@modules/ai/application/use-cases/ProcessDocumentForRAGUseCase';

export interface PDFProcessingJobPayload {
  tenantId: string;
  documentId: string;
  fileUrl: string;
  fileName: string;
}

@Processor('pdf-processing')
export class PDFProcessingProcessor extends WorkerHost {
  private readonly logger = new Logger(PDFProcessingProcessor.name);

  constructor(
    private readonly processDocumentUseCase: ProcessDocumentForRAGUseCase,
  ) {
    super();
  }

  async process(job: Job<PDFProcessingJobPayload>): Promise<void> {
    if (job.name !== 'process-document') {
      this.logger.warn(
        `[PDFProcessingProcessor] unknown job name: ${job.name}`,
      );
      return;
    }

    const { tenantId, documentId, fileUrl, fileName } = job.data;

    this.logger.log(
      `[PDFProcessingProcessor] processing doc=${documentId} fileName=${fileName}`,
    );

    await this.processDocumentUseCase.execute({
      tenantId,
      documentId,
      fileUrl,
      fileName,
    });
  }
}
