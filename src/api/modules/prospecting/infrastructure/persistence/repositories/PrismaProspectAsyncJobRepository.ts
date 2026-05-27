import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import {
  CompleteProspectingAsyncJobInput,
  CreateProspectingAsyncJobInput,
  IProspectAsyncJobRepository,
  MarkProcessingProspectingAsyncJobInput,
  ProspectingAsyncJobDownloadPayload,
  ProspectingAsyncJobStatus,
  ProspectingAsyncJobType,
  ProspectingAsyncJobView,
} from '../../../domain/repositories/IProspectAsyncJobRepository';

interface ProspectingAsyncJobRow {
  id: string;
  tenant_id: string;
  type: ProspectingAsyncJobType;
  status: ProspectingAsyncJobStatus;
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

@Injectable()
export class PrismaProspectAsyncJobRepository implements IProspectAsyncJobRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    input: CreateProspectingAsyncJobInput,
  ): Promise<ProspectingAsyncJobView> {
    // tenant-safe: tenantId is a required first-class param written as the first column in the INSERT
    const rows = await this.prisma.$queryRaw<
      ProspectingAsyncJobRow[]
    >(Prisma.sql`
      INSERT INTO prospecting_schema.prospecting_async_jobs (
        tenant_id,
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
    // tenant-safe: jobId is an opaque UUID issued at creation (which is tenant-scoped); only called by internal queue workers
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE prospecting_schema.prospecting_async_jobs
      SET queue_job_id = ${queueJobId},
          updated_at = NOW()
      WHERE id = ${jobId}::uuid
    `);
  }

  async markProcessing(
    jobId: string,
    input?: MarkProcessingProspectingAsyncJobInput,
  ): Promise<void> {
    // tenant-safe: jobId is an opaque UUID issued at creation (which is tenant-scoped); only called by internal queue workers
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE prospecting_schema.prospecting_async_jobs
      SET status = 'PROCESSING',
          progress = ${input?.progress ?? 25},
          total_items = COALESCE(${input?.totalItems ?? null}, total_items),
          updated_at = NOW(),
          failed_at = NULL,
          error_message = NULL
      WHERE id = ${jobId}::uuid
    `);
  }

  async complete(
    jobId: string,
    input: CompleteProspectingAsyncJobInput,
  ): Promise<void> {
    // tenant-safe: jobId is an opaque UUID issued at creation (which is tenant-scoped); only called by internal queue workers
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE prospecting_schema.prospecting_async_jobs
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

  async fail(jobId: string, errorMessage: string): Promise<void> {
    // tenant-safe: jobId is an opaque UUID issued at creation (which is tenant-scoped); only called by internal queue workers
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE prospecting_schema.prospecting_async_jobs
      SET status = 'FAILED',
          error_message = ${errorMessage},
          failed_at = NOW(),
          updated_at = NOW()
      WHERE id = ${jobId}::uuid
    `);
  }

  async findByTenant(
    tenantId: string,
    limit = 15,
  ): Promise<ProspectingAsyncJobView[]> {
    // tenant-safe: WHERE clause filters by tenant_id = ${tenantId}::uuid
    const rows = await this.prisma.$queryRaw<
      ProspectingAsyncJobRow[]
    >(Prisma.sql`
      SELECT *
      FROM prospecting_schema.prospecting_async_jobs
      WHERE tenant_id = ${tenantId}::uuid
      ORDER BY created_at DESC
      LIMIT ${limit}
    `);

    return rows.map((row) => this.toView(row));
  }

  async findOne(
    tenantId: string,
    jobId: string,
  ): Promise<ProspectingAsyncJobView | null> {
    // tenant-safe: WHERE clause filters by tenant_id = ${tenantId}::uuid AND id
    const rows = await this.prisma.$queryRaw<
      ProspectingAsyncJobRow[]
    >(Prisma.sql`
      SELECT *
      FROM prospecting_schema.prospecting_async_jobs
      WHERE tenant_id = ${tenantId}::uuid
        AND id = ${jobId}::uuid
      LIMIT 1
    `);

    return rows[0] ? this.toView(rows[0]) : null;
  }

  async getDownloadPayload(
    tenantId: string,
    jobId: string,
  ): Promise<ProspectingAsyncJobDownloadPayload | null> {
    // tenant-safe: WHERE clause filters by tenant_id = ${tenantId}::uuid AND id AND status
    const rows = await this.prisma.$queryRaw<
      ProspectingAsyncJobRow[]
    >(Prisma.sql`
      SELECT *
      FROM prospecting_schema.prospecting_async_jobs
      WHERE tenant_id = ${tenantId}::uuid
        AND id = ${jobId}::uuid
        AND status = 'COMPLETED'
      LIMIT 1
    `);

    if (!rows[0]) {
      return null;
    }

    return {
      fileName: rows[0].file_name ?? `prospecting-report-${jobId}.csv`,
      fileMimeType: rows[0].file_mime_type ?? 'text/csv;charset=utf-8',
      fileContent: rows[0].file_content,
      fileUrl: rows[0].file_url,
    };
  }

  private toView(row: ProspectingAsyncJobRow): ProspectingAsyncJobView {
    return {
      id: row.id,
      tenantId: row.tenant_id,
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
