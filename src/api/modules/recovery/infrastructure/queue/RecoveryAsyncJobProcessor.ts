import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  FILE_STORAGE_SERVICE,
  FileStorageService,
} from '@shared/domain/services/FileStorageService';
import { RecoveryAsyncJobsService } from '../../infrastructure/persistence/repositories/RecoveryAsyncJobsService';
import { RecoveryReportCsvBuilder } from '../../application/services/RecoveryReportCsvBuilder';
import { GenerateRecoveryReportUseCase } from '../../application/use-cases/GenerateRecoveryReportUseCase';

type RecoveryAsyncJobPayload = {
  asyncJobId: string;
  type: 'EXPORT_RECOVERY_REPORT_CSV';
  tenantId: string;
  branchId?: string | null;
  statuses?: string[];
  sources?: string[];
  search?: string;
  dateFrom?: string;
  dateTo?: string;
};

@Processor('recovery-async-jobs')
export class RecoveryAsyncJobProcessor extends WorkerHost {
  private readonly logger = new Logger(RecoveryAsyncJobProcessor.name);

  constructor(
    private readonly recoveryAsyncJobsService: RecoveryAsyncJobsService,
    private readonly generateRecoveryReportUseCase: GenerateRecoveryReportUseCase,
    private readonly recoveryReportCsvBuilder: RecoveryReportCsvBuilder,
    @Inject(FILE_STORAGE_SERVICE)
    private readonly fileStorageService: FileStorageService,
  ) {
    super();
  }

  async process(job: Job<RecoveryAsyncJobPayload>): Promise<void> {
    if (job.name !== 'export-recovery-report-csv') {
      return;
    }

    await this.recoveryAsyncJobsService.markProcessing(job.data.asyncJobId, {
      progress: 30,
    });

    try {
      const report = await this.generateRecoveryReportUseCase.execute({
        tenantId: job.data.tenantId,
        branchId: job.data.branchId ?? undefined,
        statuses: job.data.statuses,
        sources: job.data.sources,
        search: job.data.search,
        dateFrom: this.parseOptionalDate(job.data.dateFrom),
        dateTo: this.parseOptionalDate(job.data.dateTo),
      });

      const csv = this.recoveryReportCsvBuilder.build(report);
      let fileUrl: string | undefined;
      const fileContent = csv.content;

      try {
        const uploadedUrl = await this.fileStorageService.upload(
          Buffer.from(csv.content, 'utf-8'),
          csv.fileName,
          csv.mimeType,
          { folder: `tenant-${job.data.tenantId}/recovery-reports` },
        );

        if (uploadedUrl) {
          fileUrl = uploadedUrl;
        }
      } catch (error) {
        this.logger.warn(
          `Falling back to database file storage for recovery export ${job.data.asyncJobId}: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        );
      }

      await this.recoveryAsyncJobsService.completeJob(job.data.asyncJobId, {
        processedItems: report.items.length,
        totalItems: report.items.length,
        resultSummary: {
          totalCases: report.summary.totalCases,
          openCases: report.summary.openCases,
          promiseCases: report.summary.promiseCases,
          paidCases: report.summary.paidCases,
          guidanceCases: report.summary.guidanceCases,
          openAmount: report.summary.openAmount,
          paidAmount: report.summary.paidAmount,
        },
        fileName: csv.fileName,
        fileMimeType: csv.mimeType,
        fileUrl,
        fileContent,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Falha ao gerar relatorio de cobranças.';
      await this.recoveryAsyncJobsService.failJob(job.data.asyncJobId, message);
      throw error;
    }
  }

  private parseOptionalDate(value?: string): Date | undefined {
    if (!value) {
      return undefined;
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }
}
