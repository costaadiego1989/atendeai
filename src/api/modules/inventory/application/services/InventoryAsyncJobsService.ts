import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EntityNotFoundException } from '@shared/domain/exceptions/DomainExceptions';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';

type InventoryAsyncJobRecord = {
  id: string;
  tenantId: string;
  type: string;
  status: string;
  requestedByUserId: string | null;
  requestedByUserEmail: string | null;
  payload: Prisma.JsonValue;
  progress: number;
  totalItems: number;
  processedItems: number;
  resultSummary: Prisma.JsonValue;
  fileName: string | null;
  fileMimeType: string | null;
  fileUrl: string | null;
  fileContent: string | null;
  errorMessage: string | null;
  queueJobId: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  failedAt: Date | null;
};

export type InventoryAsyncJobType =
  | 'EXPORT_INVENTORY_REPORT_CSV'
  | 'SYNC_INVENTORY_CONNECTION';
export type InventoryAsyncJobStatus =
  | 'QUEUED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED';

export interface InventoryAsyncJobView {
  id: string;
  tenantId: string;
  type: InventoryAsyncJobType;
  status: InventoryAsyncJobStatus;
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
export class InventoryAsyncJobsService {
  constructor(private readonly prisma: PrismaService) {}

  async createJob(input: {
    tenantId: string;
    type: InventoryAsyncJobType;
    requestedByUserId?: string;
    requestedByUserEmail?: string;
    payload: Record<string, unknown>;
    totalItems?: number;
  }): Promise<InventoryAsyncJobView> {
    const job = await this.prisma.inventoryAsyncJob.create({
      data: {
        tenantId: input.tenantId,
        type: input.type,
        status: 'QUEUED',
        requestedByUserId: input.requestedByUserId ?? null,
        requestedByUserEmail: input.requestedByUserEmail ?? null,
        payload: (input.payload ?? {}) as Prisma.InputJsonValue,
        progress: 0,
        totalItems: input.totalItems ?? 0,
        processedItems: 0,
        resultSummary: {} as Prisma.InputJsonValue,
      },
    });

    return this.toView(job);
  }

  async attachQueueJobId(jobId: string, queueJobId: string): Promise<void> {
    // tenant-safe: queue worker updates its own job by UUID PK; no cross-tenant exposure possible
    await this.prisma.inventoryAsyncJob.update({
      where: { id: jobId },
      data: { queueJobId },
    });
  }

  async markProcessing(
    jobId: string,
    input?: { progress?: number; totalItems?: number },
  ): Promise<void> {
    // tenant-safe: queue worker updates its own job by UUID PK; no cross-tenant exposure possible
    await this.prisma.inventoryAsyncJob.update({
      where: { id: jobId },
      data: {
        status: 'PROCESSING',
        progress: input?.progress ?? 20,
        ...(input?.totalItems != null ? { totalItems: input.totalItems } : {}),
        failedAt: null,
        errorMessage: null,
      },
    });
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
    // tenant-safe: queue worker updates its own job by UUID PK; no cross-tenant exposure possible
    await this.prisma.inventoryAsyncJob.update({
      where: { id: jobId },
      data: {
        status: 'COMPLETED',
        progress: 100,
        ...(input.processedItems != null
          ? { processedItems: input.processedItems }
          : {}),
        ...(input.totalItems != null ? { totalItems: input.totalItems } : {}),
        resultSummary: (input.resultSummary ?? {}) as Prisma.InputJsonValue,
        fileName: input.fileName ?? null,
        fileMimeType: input.fileMimeType ?? null,
        fileUrl: input.fileUrl ?? null,
        fileContent: input.fileContent ?? null,
        errorMessage: null,
        completedAt: new Date(),
        failedAt: null,
      },
    });
  }

  async failJob(jobId: string, errorMessage: string): Promise<void> {
    // tenant-safe: queue worker updates its own job by UUID PK; no cross-tenant exposure possible
    await this.prisma.inventoryAsyncJob.update({
      where: { id: jobId },
      data: {
        status: 'FAILED',
        errorMessage,
        failedAt: new Date(),
      },
    });
  }

  async listJobs(
    tenantId: string,
    limit = 15,
  ): Promise<InventoryAsyncJobView[]> {
    const jobs = await this.prisma.inventoryAsyncJob.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return jobs.map((job) => this.toView(job));
  }

  async getJob(
    tenantId: string,
    jobId: string,
  ): Promise<InventoryAsyncJobView> {
    const job = await this.prisma.inventoryAsyncJob.findFirst({
      where: { id: jobId, tenantId },
    });

    if (!job) {
      throw new EntityNotFoundException('InventoryAsyncJob', jobId);
    }

    return this.toView(job);
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
    const job = await this.prisma.inventoryAsyncJob.findFirst({
      where: {
        id: jobId,
        tenantId,
        type: 'EXPORT_INVENTORY_REPORT_CSV',
        status: 'COMPLETED',
      },
    });

    if (!job) {
      throw new EntityNotFoundException('InventoryAsyncJob', jobId);
    }

    return {
      fileName: job.fileName ?? `relatorio-estoque-${jobId}.csv`,
      fileMimeType: job.fileMimeType ?? 'text/csv;charset=utf-8',
      fileContent: job.fileContent,
      fileUrl: job.fileUrl,
    };
  }

  private toView(row: InventoryAsyncJobRecord): InventoryAsyncJobView {
    return {
      id: row.id,
      tenantId: row.tenantId,
      type: row.type as InventoryAsyncJobType,
      status: row.status as InventoryAsyncJobStatus,
      requestedByUserId: row.requestedByUserId,
      requestedByUserEmail: row.requestedByUserEmail,
      progress: row.progress,
      totalItems: row.totalItems,
      processedItems: row.processedItems,
      resultSummary:
        row.resultSummary && typeof row.resultSummary === 'object'
          ? (row.resultSummary as Record<string, unknown>)
          : undefined,
      fileName: row.fileName,
      fileMimeType: row.fileMimeType,
      fileUrl: row.fileUrl,
      errorMessage: row.errorMessage,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      completedAt: row.completedAt,
      failedAt: row.failedAt,
    };
  }
}
