import { Inject, Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { IUseCase } from '@shared/application/IUseCase';
import {
  CatalogAsyncJobsService,
  CatalogAsyncJobView,
} from '../services/CatalogAsyncJobsService';

export interface EnqueueCatalogReportJobCommand {
  tenantId: string;
  userId?: string;
  userEmail?: string;
  types?: string[];
  categoryIds?: string[];
  query?: string;
  includeInactive?: boolean;
}

@Injectable()
export class EnqueueCatalogReportJobUseCase implements IUseCase<
  EnqueueCatalogReportJobCommand,
  CatalogAsyncJobView
> {
  constructor(
    private readonly catalogAsyncJobsService: CatalogAsyncJobsService,
    @InjectQueue('catalog-async-jobs')
    private readonly catalogAsyncQueue: Queue,
  ) {}

  async execute(
    command: EnqueueCatalogReportJobCommand,
  ): Promise<CatalogAsyncJobView> {
    const asyncJob = await this.catalogAsyncJobsService.createJob({
      tenantId: command.tenantId,
      type: 'EXPORT_CATALOG_REPORT_CSV',
      requestedByUserId: command.userId,
      requestedByUserEmail: command.userEmail,
      payload: {
        types: command.types ?? [],
        categoryIds: command.categoryIds ?? [],
        query: command.query,
        includeInactive: command.includeInactive ?? false,
      },
    });

    const queueJob = await this.catalogAsyncQueue.add(
      'export-catalog-report-csv',
      {
        asyncJobId: asyncJob.id,
        type: 'EXPORT_CATALOG_REPORT_CSV',
        tenantId: command.tenantId,
        types: command.types ?? [],
        categoryIds: command.categoryIds ?? [],
        query: command.query,
        includeInactive: command.includeInactive ?? false,
      },
      {
        jobId: asyncJob.id,
        attempts: 2,
        removeOnComplete: 50,
        removeOnFail: 200,
      },
    );

    await this.catalogAsyncJobsService.attachQueueJobId(
      asyncJob.id,
      String(queueJob.id),
    );

    return this.catalogAsyncJobsService.getJob(command.tenantId, asyncJob.id);
  }
}
