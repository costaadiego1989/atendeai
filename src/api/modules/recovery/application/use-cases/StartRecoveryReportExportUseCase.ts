import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { IUseCase } from '@shared/application/IUseCase';
import {
  RecoveryAsyncJobsService,
  RecoveryAsyncJobView,
} from '../../infrastructure/persistence/repositories/RecoveryAsyncJobsService';

export interface StartRecoveryReportExportInput {
  tenantId: string;
  branchId?: string;
  statuses?: string[];
  sources?: string[];
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  requestedByUserId?: string;
  requestedByUserEmail?: string;
}

export type StartRecoveryReportExportOutput = RecoveryAsyncJobView;

@Injectable()
export class StartRecoveryReportExportUseCase implements IUseCase<
  StartRecoveryReportExportInput,
  StartRecoveryReportExportOutput
> {
  constructor(
    private readonly recoveryAsyncJobsService: RecoveryAsyncJobsService,
    @InjectQueue('recovery-async-jobs')
    private readonly recoveryAsyncQueue: Queue,
  ) {}

  async execute(
    input: StartRecoveryReportExportInput,
  ): Promise<StartRecoveryReportExportOutput> {
    const normalizedSearch = input.search?.trim() || undefined;
    const statuses = input.statuses ?? [];
    const sources = input.sources ?? [];

    const asyncJob = await this.recoveryAsyncJobsService.createJob({
      tenantId: input.tenantId,
      branchId: input.branchId,
      type: 'EXPORT_RECOVERY_REPORT_CSV',
      requestedByUserId: input.requestedByUserId,
      requestedByUserEmail: input.requestedByUserEmail,
      payload: {
        branchId: input.branchId,
        statuses,
        sources,
        search: normalizedSearch,
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
      },
    });

    try {
      const queueJob = await this.recoveryAsyncQueue.add(
        'export-recovery-report-csv',
        {
          asyncJobId: asyncJob.id,
          type: 'EXPORT_RECOVERY_REPORT_CSV',
          tenantId: input.tenantId,
          branchId: input.branchId,
          statuses,
          sources,
          search: normalizedSearch,
          dateFrom: input.dateFrom,
          dateTo: input.dateTo,
        },
        {
          jobId: asyncJob.id,
          attempts: 2,
          removeOnComplete: 50,
          removeOnFail: 200,
        },
      );

      await this.recoveryAsyncJobsService.attachQueueJobId(
        asyncJob.id,
        String(queueJob.id),
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to enqueue job';
      await this.recoveryAsyncJobsService.failJob(asyncJob.id, message);
      throw error;
    }

    return this.recoveryAsyncJobsService.getJob(input.tenantId, asyncJob.id);
  }
}
