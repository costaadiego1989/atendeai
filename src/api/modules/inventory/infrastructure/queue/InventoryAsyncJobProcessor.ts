import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { FILE_STORAGE_SERVICE, FileStorageService } from '@shared/domain/services/FileStorageService';
import { InventoryAsyncJobsService } from '../../application/services/InventoryAsyncJobsService';
import { InventoryReportCsvBuilder } from '../../application/services/InventoryReportCsvBuilder';
import { GenerateInventoryReportUseCase } from '../../application/use-cases/GenerateInventoryReportUseCase';

type InventoryAsyncJobPayload = {
  asyncJobId: string;
  type: 'EXPORT_INVENTORY_REPORT_CSV';
  tenantId: string;
  query?: string;
  availableOnly?: boolean;
  statuses?: Array<'AVAILABLE' | 'LOW_STOCK' | 'UNAVAILABLE' | 'RESERVED'>;
};

@Processor('inventory-async-jobs')
export class InventoryAsyncJobProcessor extends WorkerHost {
  private readonly logger = new Logger(InventoryAsyncJobProcessor.name);

  constructor(
    private readonly inventoryAsyncJobsService: InventoryAsyncJobsService,
    private readonly generateInventoryReportUseCase: GenerateInventoryReportUseCase,
    private readonly inventoryReportCsvBuilder: InventoryReportCsvBuilder,
    @Inject(FILE_STORAGE_SERVICE)
    private readonly fileStorageService: FileStorageService,
  ) {
    super();
  }

  async process(job: Job<InventoryAsyncJobPayload>): Promise<void> {
    if (job.name !== 'export-inventory-report-csv') {
      return;
    }

    await this.inventoryAsyncJobsService.markProcessing(job.data.asyncJobId, {
      progress: 30,
    });

    try {
      const report = await this.generateInventoryReportUseCase.execute({
        tenantId: job.data.tenantId,
        query: job.data.query,
        availableOnly: job.data.availableOnly,
        statuses: job.data.statuses,
      });

      const csv = this.inventoryReportCsvBuilder.build(report);
      const fileContent = csv.content;
      let fileUrl: string | undefined;

      try {
        const uploadedUrl = await this.fileStorageService.upload(
          Buffer.from(csv.content, 'utf-8'),
          csv.fileName,
          csv.mimeType,
          { folder: `tenant-${job.data.tenantId}/inventory-reports` },
        );

        if (uploadedUrl) {
          fileUrl = uploadedUrl;
        }
      } catch (error) {
        this.logger.warn(
          `Falling back to database file storage for inventory export ${job.data.asyncJobId}: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        );
      }

      await this.inventoryAsyncJobsService.completeJob(job.data.asyncJobId, {
        processedItems: report.items.length,
        totalItems: report.items.length,
        resultSummary: {
          totalItems: report.summary.totalItems,
          totalQuantity: report.summary.totalQuantity,
          availableItems: report.summary.availableItems,
          lowStockItems: report.summary.lowStockItems,
          unavailableItems: report.summary.unavailableItems,
          reservedItems: report.summary.reservedItems,
          estimatedInventoryValue: report.summary.estimatedInventoryValue,
        },
        fileName: csv.fileName,
        fileMimeType: csv.mimeType,
        fileUrl,
        fileContent,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Falha ao exportar relatorio de estoque.';
      await this.inventoryAsyncJobsService.failJob(job.data.asyncJobId, message);
      throw error;
    }
  }
}
