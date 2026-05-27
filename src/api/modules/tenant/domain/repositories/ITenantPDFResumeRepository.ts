import {
  TenantPDFResumeMeta,
  TenantPDFResumeRecord,
  UpsertTenantPDFResumeRecordInput,
} from '../../infrastructure/persistence/repositories/TenantPDFResumeRepository';

export interface ITenantPDFResumeRepository {
  upsert(
    input: UpsertTenantPDFResumeRecordInput,
  ): Promise<TenantPDFResumeRecord>;
  listByTenant(tenantId: string): Promise<TenantPDFResumeRecord[]>;
  listReadySummaries(tenantId: string): Promise<string[]>;
  listReadyWithMeta(tenantId: string): Promise<TenantPDFResumeMeta[]>;
  updateStatus(
    tenantId: string,
    documentId: string,
    status: string,
    error?: string | null,
  ): Promise<void>;
  findById(
    documentId: string,
    tenantId: string,
  ): Promise<TenantPDFResumeRecord | null>;
  findByChecksum(
    tenantId: string,
    checksum: string,
  ): Promise<TenantPDFResumeRecord | null>;
  deleteById(documentId: string, tenantId: string): Promise<void>;
}

export const TENANT_PDF_RESUME_REPOSITORY = Symbol(
  'TENANT_PDF_RESUME_REPOSITORY',
);
