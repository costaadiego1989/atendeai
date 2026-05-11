import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EntityNotFoundException } from '@shared/domain/exceptions/DomainExceptions';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';

export type ContactAsyncJobType = 'IMPORT_CONTACTS' | 'EXPORT_CONTACTS_CSV';
export type ContactAsyncJobStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

interface ContactAsyncJobRow {
  id: string;
  tenant_id: string;
  branch_id: string | null;
  type: ContactAsyncJobType;
  status: ContactAsyncJobStatus;
  requested_by_user_id: string | null;
  requested_by_user_email: string | null;
  payload: unknown;
  progress: number;
  total_items: number;
  processed_items: number;
  result_summary: unknown;
  file_name: string | null;
  file_mime_type: string | null;
  file_url: string | null;
  file_content: string | null;
  error_message: string | null;
  queue_job_id: string | null;
  created_at: Date;
  updated_at: Date;
  completed_at: Date | null;
  failed_at: Date | null;
}

export interface ContactAsyncJobView {
  id: string;
  tenantId: string;
  branchId?: string | null;
  type: ContactAsyncJobType;
  status: ContactAsyncJobStatus;
  requestedByUserId?: string | null;
  requestedByUserEmail?: string | null;
  progress: number;
  totalItems: number;
  processedItems: number;
  resultSummary?: Record<string, unknown>;
  fileName?: string | null;
  fileMimeType?: string | null;
  fileUrl?: string | null;
  errorMessage?: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date | null;
  failedAt?: Date | null;
}

@Injectable()
export class ContactAsyncJobsService {
  constructor(private readonly prisma: PrismaService) {}

  async createJob(input: {
    tenantId: string;
    branchId?: string;
    type: ContactAsyncJobType;
    requestedByUserId?: string;
    requestedByUserEmail?: string;
    payload: Record<string, unknown>;
    totalItems?: number;
  }): Promise<ContactAsyncJobView> {
    const rows = await this.prisma.$queryRaw<ContactAsyncJobRow[]>(Prisma.sql`
      INSERT INTO contact_schema.contact_async_jobs (
        tenant_id,
        branch_id,
        type,
        status,
        requested_by_user_id,
        requested_by_user_email,
        payload,
        progress,
        total_items,
        processed_items,
        result_summary
      )
      VALUES (
        ${input.tenantId}::uuid,
        ${input.branchId ?? null}::uuid,
        ${input.type},
        'QUEUED',
        ${input.requestedByUserId ?? null}::uuid,
        ${input.requestedByUserEmail ?? null},
        ${JSON.stringify(input.payload)}::jsonb,
        0,
        ${input.totalItems ?? 0},
        0,
        '{}'::jsonb
      )
      RETURNING *
    `);

    return this.toView(rows[0]);
  }

  async attachQueueJobId(jobId: string, queueJobId: string): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE contact_schema.contact_async_jobs
      SET queue_job_id = ${queueJobId},
          updated_at = NOW()
      WHERE id = ${jobId}::uuid
    `);
  }

  async markProcessing(jobId: string, input?: { progress?: number; totalItems?: number }): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE contact_schema.contact_async_jobs
      SET status = 'PROCESSING',
          progress = ${input?.progress ?? 10},
          total_items = COALESCE(${input?.totalItems ?? null}, total_items),
          updated_at = NOW(),
          failed_at = NULL,
          error_message = NULL
      WHERE id = ${jobId}::uuid
    `);
  }

  async completeJob(
    jobId: string,
    input: {
      processedItems?: number;
      totalItems?: number;
      resultSummary?: Record<string, unknown>;
      fileName?: string;
      fileMimeType?: string;
      fileUrl?: string;
      fileContent?: string;
    },
  ): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE contact_schema.contact_async_jobs
      SET status = 'COMPLETED',
          progress = 100,
          processed_items = COALESCE(${input.processedItems ?? null}, processed_items),
          total_items = COALESCE(${input.totalItems ?? null}, total_items),
          result_summary = ${JSON.stringify(input.resultSummary ?? {})}::jsonb,
          file_name = ${input.fileName ?? null},
          file_mime_type = ${input.fileMimeType ?? null},
          file_url = ${input.fileUrl ?? null},
          file_content = ${input.fileContent ?? null},
          error_message = NULL,
          completed_at = NOW(),
          failed_at = NULL,
          updated_at = NOW()
      WHERE id = ${jobId}::uuid
    `);
  }

  async failJob(jobId: string, errorMessage: string): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE contact_schema.contact_async_jobs
      SET status = 'FAILED',
          error_message = ${errorMessage},
          failed_at = NOW(),
          updated_at = NOW()
      WHERE id = ${jobId}::uuid
    `);
  }

  async listJobs(tenantId: string, limit = 15): Promise<ContactAsyncJobView[]> {
    const rows = await this.prisma.$queryRaw<ContactAsyncJobRow[]>(Prisma.sql`
      SELECT *
      FROM contact_schema.contact_async_jobs
      WHERE tenant_id = ${tenantId}::uuid
      ORDER BY created_at DESC
      LIMIT ${limit}
    `);

    return rows.map((row) => this.toView(row));
  }

  async getJob(tenantId: string, jobId: string): Promise<ContactAsyncJobView> {
    const rows = await this.prisma.$queryRaw<ContactAsyncJobRow[]>(Prisma.sql`
      SELECT *
      FROM contact_schema.contact_async_jobs
      WHERE tenant_id = ${tenantId}::uuid
        AND id = ${jobId}::uuid
      LIMIT 1
    `);

    if (!rows[0]) {
      throw new EntityNotFoundException('ContactAsyncJob', jobId);
    }

    return this.toView(rows[0]);
  }

  async getDownloadPayload(
    tenantId: string,
    jobId: string,
  ): Promise<{
    fileName: string;
    fileMimeType: string;
    fileContent?: string | null;
    fileUrl?: string | null;
  }> {
    const rows = await this.prisma.$queryRaw<ContactAsyncJobRow[]>(Prisma.sql`
      SELECT *
      FROM contact_schema.contact_async_jobs
      WHERE tenant_id = ${tenantId}::uuid
        AND id = ${jobId}::uuid
        AND type = 'EXPORT_CONTACTS_CSV'
        AND status = 'COMPLETED'
      LIMIT 1
    `);

    if (!rows[0]) {
      throw new EntityNotFoundException('ContactAsyncJob', jobId);
    }

    return {
      fileName: rows[0].file_name ?? `relatorio-contatos-${jobId}.csv`,
      fileMimeType: rows[0].file_mime_type ?? 'text/csv;charset=utf-8',
      fileContent: rows[0].file_content,
      fileUrl: rows[0].file_url,
    };
  }

  private toView(row: ContactAsyncJobRow): ContactAsyncJobView {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      branchId: row.branch_id,
      type: row.type,
      status: row.status,
      requestedByUserId: row.requested_by_user_id,
      requestedByUserEmail: row.requested_by_user_email,
      progress: row.progress,
      totalItems: row.total_items,
      processedItems: row.processed_items,
      resultSummary:
        row.result_summary && typeof row.result_summary === 'object'
          ? (row.result_summary as Record<string, unknown>)
          : undefined,
      fileName: row.file_name,
      fileMimeType: row.file_mime_type,
      fileUrl: row.file_url,
      errorMessage: row.error_message,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at,
      failedAt: row.failed_at,
    };
  }

}
