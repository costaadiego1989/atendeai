import { Injectable } from '@nestjs/common';
import {
  TenantPDFResumeMeta,
  TenantPDFResumeRepository,
} from '../../infrastructure/persistence/repositories/TenantPDFResumeRepository';

export interface ITenantPDFResumeQueryPort {
  listReadyWithMeta(tenantId: string): Promise<TenantPDFResumeMeta[]>;
  updateStatus(
    tenantId: string,
    documentId: string,
    status: string,
    error?: string | null,
  ): Promise<void>;
}

export const TENANT_PDF_RESUME_QUERY_PORT = 'TENANT_PDF_RESUME_QUERY_PORT';

@Injectable()
export class TenantPDFResumeFacade implements ITenantPDFResumeQueryPort {
  constructor(private readonly repository: TenantPDFResumeRepository) {}

  async listReadyWithMeta(tenantId: string): Promise<TenantPDFResumeMeta[]> {
    return this.repository.listReadyWithMeta(tenantId);
  }

  async updateStatus(
    tenantId: string,
    documentId: string,
    status: string,
    error?: string | null,
  ): Promise<void> {
    await this.repository.updateStatus(tenantId, documentId, status, error);
  }
}
