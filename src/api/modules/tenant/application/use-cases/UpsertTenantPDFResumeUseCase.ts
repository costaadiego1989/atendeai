import { Injectable } from '@nestjs/common';
import { TenantPDFResumeRepository } from '../../infrastructure/persistence/repositories/TenantPDFResumeRepository';

export interface UpsertTenantPDFResumeInput {
  tenantId: string;
  fileName: string;
  fileUrl?: string | null;
  checksum?: string | null;
  extractedText?: string | null;
  summaries?: string[] | null;
}

@Injectable()
export class UpsertTenantPDFResumeUseCase {
  constructor(private readonly repository: TenantPDFResumeRepository) {}

  async execute(input: UpsertTenantPDFResumeInput) {
    const summaries = this.buildSummaries(input);

    return this.repository.upsert({
      tenantId: input.tenantId,
      fileName: input.fileName,
      fileUrl: input.fileUrl ?? null,
      checksum: input.checksum ?? null,
      summaries,
      status: summaries.length > 0 ? 'READY' : 'PROCESSING',
      error: null,
    });
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
    for (let index = 0; index < normalized.length && chunks.length < 8; index += 900) {
      chunks.push(normalized.slice(index, index + 900).trim());
    }

    return chunks;
  }
}
