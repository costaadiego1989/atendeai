import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  FILE_STORAGE_SERVICE,
  FileStorageService,
} from '@shared/domain/services/FileStorageService';
import { InventoryAsyncJobsService } from '../../infrastructure/persistence/repositories/InventoryAsyncJobsService';
import { InventoryReportCsvBuilder } from '../../application/services/InventoryReportCsvBuilder';
import { GenerateInventoryReportUseCase } from '../../application/use-cases/GenerateInventoryReportUseCase';
import { SyncInventoryConnectionUseCase } from '../../application/use-cases/SyncInventoryConnectionUseCase';

type ExportReportPayload = {
  asyncJobId: string;
  type: 'EXPORT_INVENTORY_REPORT_CSV';
  tenantId: string;
  query?: string;
  availableOnly?: boolean;
  statuses?: Array<'AVAILABLE' | 'LOW_STOCK' | 'UNAVAILABLE' | 'RESERVED'>;
};

type SyncConnectionPayload = {
  asyncJobId: string;
  type: 'SYNC_INVENTORY_CONNECTION';
  tenantId: string;
  connectionId: string;
};

type InventoryAsyncJobPayload = ExportReportPayload | SyncConnectionPayload;

@Processor('inventory-async-jobs')
export class InventoryAsyncJobProcessor extends WorkerHost {
  private readonly logger = new Logger(InventoryAsyncJobProcessor.name);

  constructor(
    private readonly inventoryAsyncJobsService: InventoryAsyncJobsService,
    private readonly generateInventoryReportUseCase: GenerateInventoryReportUseCase,
    private readonly inventoryReportCsvBuilder: InventoryReportCsvBuilder,
    @Inject(FILE_STORAGE_SERVICE)
    private readonly fileStorageService: FileStorageService,
    private readonly syncInventoryConnectionUseCase: SyncInventoryConnectionUseCase,
  ) {
    super();
  }

  async process(job: Job<InventoryAsyncJobPayload>): Promise<void> {
    if (job.name === 'sync-inventory-connection') {
      return this.processSyncConnection(job as Job<SyncConnectionPayload>);
    }

    if (job.name !== 'export-inventory-report-csv') {
      return;
    }

    const exportData = job.data as ExportReportPayload;

    await this.inventoryAsyncJobsService.markProcessing(exportData.asyncJobId, {
      progress: 30,
    });

    try {
      const report = await this.generateInventoryReportUseCase.execute({
        tenantId: exportData.tenantId,
        query: exportData.query,
        availableOnly: exportData.availableOnly,
        statuses: exportData.statuses,
      });

      const csv = this.inventoryReportCsvBuilder.build(report);
      const fileContent = csv.content;
      let fileUrl: string | undefined;

      try {
        const uploadedUrl = await this.fileStorageService.upload(
          Buffer.from(csv.content, 'utf-8'),
          csv.fileName,
          csv.mimeType,
          { folder: `tenant-${exportData.tenantId}/inventory-reports` },
        );

        if (uploadedUrl) {
          fileUrl = uploadedUrl;
        }
      } catch (error) {
        this.logger.warn(
          `Falling back to database file storage for inventory export ${exportData.asyncJobId}: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        );
      }

      await this.inventoryAsyncJobsService.completeJob(exportData.asyncJobId, {
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
        fileContent: fileUrl ? undefined : fileContent,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Falha ao exportar relatorio de estoque.';
      await this.inventoryAsyncJobsService.failJob(
        exportData.asyncJobId,
        message,
      );
      throw error;
    }
  }

  private async processSyncConnection(
    job: Job<SyncConnectionPayload>,
  ): Promise<void> {
    const { asyncJobId, tenantId, connectionId } = job.data;

    await this.inventoryAsyncJobsService.markProcessing(asyncJobId, {
      progress: 20,
    });

    try {
      await this.syncInventoryConnectionUseCase.execute({
        tenantId,
        connectionId,
      });

      await this.inventoryAsyncJobsService.completeJob(asyncJobId, {
        processedItems: 0,
        totalItems: 0,
        resultSummary: { connectionId, tenantId },
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Falha ao sincronizar conexão de inventário.';
      this.logger.error(
        `Sync connection job ${asyncJobId} failed for connection ${connectionId}: ${message}`,
      );
      await this.inventoryAsyncJobsService.failJob(asyncJobId, message);
      throw error;
    }
  }
}
