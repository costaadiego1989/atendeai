import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { TenantPDFResumeRepository } from '../../infrastructure/persistence/repositories/TenantPDFResumeRepository';

export interface UpsertTenantPDFResumeInput {
  tenantId: string;
  fileName: string;
  fileUrl?: string | null;
  checksum?: string | null;
  extractedText?: string | null;
  summaries?: string[] | null;
  canSendIt?: boolean;
}

@Injectable()
export class UpsertTenantPDFResumeUseCase {
  private readonly logger = new Logger(UpsertTenantPDFResumeUseCase.name);

  constructor(
    private readonly repository: TenantPDFResumeRepository,
    @InjectQueue('pdf-processing') private readonly pdfProcessingQueue: Queue,
  ) {}

  async execute(input: UpsertTenantPDFResumeInput) {
    const summaries = this.buildSummaries(input);

    const record = await this.repository.upsert({
      tenantId: input.tenantId,
      fileName: input.fileName,
      fileUrl: input.fileUrl ?? null,
      checksum: input.checksum ?? null,
      summaries,
      status: 'PROCESSING',
      error: null,
      canSendIt: input.canSendIt ?? false,
    });

    // Enqueue RAG processing job if we have a file URL
    if (input.fileUrl) {
      await this.pdfProcessingQueue.add(
        'process-document',
        {
          tenantId: input.tenantId,
          documentId: record.id,
          fileUrl: input.fileUrl,
          fileName: input.fileName,
        },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: 100,
          removeOnFail: 200,
        },
      );

      this.logger.log(
        `[UpsertTenantPDFResume] enqueued RAG processing for doc=${record.id} fileName=${input.fileName}`,
      );
    }

    return record;
  }

  private buildSummaries(input: UpsertTenantPDFResumeInput): string[] {
    if (input.summaries?.length) {
      return input.summaries
        .map((summary) => summary.trim())
        .filter(Boolean)
        .slice(0, 12);
    }

    const text = input.extractedText?.trim();
    if (!text) {
      return [];
    }

    const normalized = text.replace(/\s+/g, ' ');
    const chunks: string[] = [];
    for (
      let index = 0;
      index < normalized.length && chunks.length < 8;
      index += 900
    ) {
      chunks.push(normalized.slice(index, index + 900).trim());
    }

    return chunks;
  }
}
