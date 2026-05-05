import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { FILE_STORAGE_SERVICE, FileStorageService } from '@shared/domain/services/FileStorageService';
import { SchedulingAsyncJobsService } from '../../application/services/SchedulingAsyncJobsService';
import { SchedulingReportCsvBuilder } from '../../application/services/SchedulingReportCsvBuilder';
import { GenerateSchedulingReportUseCase } from '../../application/use-cases/GenerateSchedulingReportUseCase';

type SchedulingAsyncJobPayload = {
  asyncJobId: string;
  type: 'EXPORT_SCHEDULING_REPORT_CSV';
  tenantId: string;
  branchId?: string | null;
  startDate: string;
  endDate: string;
  professionalIds?: string[] | null;
  categoryIds?: string[] | null;
  statuses?: Array<'AVAILABLE' | 'PRE_RESERVED' | 'RESERVED' | 'COMPLETED' | 'NO_SHOW' | 'BLOCKED'> | null;
  totalItems?: number;
};

@Processor('scheduling-async-jobs')
export class SchedulingAsyncJobProcessor extends WorkerHost {
  private readonly logger = new Logger(SchedulingAsyncJobProcessor.name);

  constructor(
    private readonly schedulingAsyncJobsService: SchedulingAsyncJobsService,
    private readonly generateSchedulingReportUseCase: GenerateSchedulingReportUseCase,
    private readonly schedulingReportCsvBuilder: SchedulingReportCsvBuilder,
    @Inject(FILE_STORAGE_SERVICE)
    private readonly fileStorageService: FileStorageService,
  ) {
    super();
  }

  async process(job: Job<SchedulingAsyncJobPayload>): Promise<void> {
    if (job.name !== 'export-scheduling-report-csv') {
      return;
    }

    await this.handleExportJob(job);
  }

  private async handleExportJob(job: Job<SchedulingAsyncJobPayload>): Promise<void> {
    const data = job.data;

    await this.schedulingAsyncJobsService.markProcessing(data.asyncJobId, {
      progress: 25,
      totalItems: data.totalItems,
    });

    try {
      const report = await this.generateSchedulingReportUseCase.execute({
        tenantId: data.tenantId,
        branchId: data.branchId,
        startDate: data.startDate,
        endDate: data.endDate,
        professionalIds: data.professionalIds,
        categoryIds: data.categoryIds,
        statuses: data.statuses,
      });

      const csv = this.schedulingReportCsvBuilder.build(report);
      let fileUrl: string | undefined;
      const fileContent = csv.content;

      try {
        const uploadedUrl = await this.fileStorageService.upload(
          Buffer.from(csv.content, 'utf-8'),
          csv.fileName,
          csv.mimeType,
          { folder: `tenant-${data.tenantId}/scheduling-reports` },
        );

        if (uploadedUrl) {
          fileUrl = uploadedUrl;
        }
      } catch (error) {
        this.logger.warn(
          `Falling back to database file storage for scheduling export ${data.asyncJobId}: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        );
      }

      await this.schedulingAsyncJobsService.completeJob(data.asyncJobId, {
        processedItems: report.rows.length,
        totalItems: report.rows.length,
        resultSummary: {
          totalSlots: report.summary.totalSlots,
          reservedSlots: report.summary.reservedSlots,
          blockedSlots: report.summary.blockedSlots,
          availableSlots: report.summary.availableSlots,
          completedSlots: report.summary.completedSlots,
          noShowSlots: report.summary.noShowSlots,
          estimatedRevenue: report.summary.estimatedRevenue,
        },
        fileName: csv.fileName,
        fileMimeType: csv.mimeType,
        fileUrl,
        fileContent,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Falha ao gerar relatorio da agenda.';
      await this.schedulingAsyncJobsService.failJob(data.asyncJobId, message);
      throw error;
    }
  }
}
