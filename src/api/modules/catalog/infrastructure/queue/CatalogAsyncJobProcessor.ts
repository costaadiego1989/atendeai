import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  FILE_STORAGE_SERVICE,
  FileStorageService,
} from '@shared/domain/services/FileStorageService';
import { CatalogAsyncJobsService } from '../../infrastructure/persistence/repositories/CatalogAsyncJobsService';
import { CatalogReportCsvBuilder } from '../../application/services/CatalogReportCsvBuilder';
import { GenerateCatalogReportUseCase } from '../../application/use-cases/GenerateCatalogReportUseCase';
import { ImportCatalogItemsUseCase } from '../../application/use-cases/ImportCatalogItemsUseCase';

type CatalogAsyncJobPayload = {
  asyncJobId: string;
  type: 'EXPORT_CATALOG_REPORT_CSV' | 'IMPORT_CATALOG_ITEMS';
  tenantId: string;
  types?: Array<'SERVICE' | 'PRODUCT' | 'RENTAL'>;
  categoryIds?: string[];
  query?: string;
  includeInactive?: boolean;
  rawText?: string;
  defaultType?: 'SERVICE' | 'PRODUCT' | 'RENTAL';
  defaultCategoryName?: string;
  defaultSource?: 'MANUAL' | 'IMPORT' | 'ERP_SNAPSHOT';
  defaultTags?: string[];
  syncInventory?: boolean;
};

@Processor('catalog-async-jobs')
export class CatalogAsyncJobProcessor extends WorkerHost {
  private readonly logger = new Logger(CatalogAsyncJobProcessor.name);

  constructor(
    private readonly catalogAsyncJobsService: CatalogAsyncJobsService,
    private readonly generateCatalogReportUseCase: GenerateCatalogReportUseCase,
    private readonly importCatalogItemsUseCase: ImportCatalogItemsUseCase,
    private readonly catalogReportCsvBuilder: CatalogReportCsvBuilder,
    @Inject(FILE_STORAGE_SERVICE)
    private readonly fileStorageService: FileStorageService,
  ) {
    super();
  }

  async process(job: Job<CatalogAsyncJobPayload>): Promise<void> {
    if (job.name === 'export-catalog-report-csv') {
      await this.handleExportJob(job);
      return;
    }

    if (job.name === 'import-catalog-items') {
      await this.handleImportJob(job);
    }
  }

  private async handleImportJob(
    job: Job<CatalogAsyncJobPayload>,
  ): Promise<void> {
    await this.catalogAsyncJobsService.markProcessing(job.data.asyncJobId, {
      progress: 20,
    });

    try {
      const result = await this.importCatalogItemsUseCase.execute({
        tenantId: job.data.tenantId,
        rawText: job.data.rawText ?? '',
        defaultType: job.data.defaultType,
        defaultCategoryName: job.data.defaultCategoryName,
        defaultSource: job.data.defaultSource,
        defaultTags: job.data.defaultTags,
        syncInventory: job.data.syncInventory,
      });

      await this.catalogAsyncJobsService.completeJob(job.data.asyncJobId, {
        processedItems: result.processed,
        totalItems: result.totalRows,
        resultSummary: {
          totalRows: result.totalRows,
          processed: result.processed,
          created: result.created,
          updated: result.updated,
          skipped: result.skipped,
          failed: result.failed,
          inventorySynced: result.inventorySynced,
          previewItems: result.items.slice(0, 30),
        },
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Falha ao importar itens do catalogo.';
      await this.catalogAsyncJobsService.failJob(job.data.asyncJobId, message);
      throw error;
    }
  }

  private async handleExportJob(
    job: Job<CatalogAsyncJobPayload>,
  ): Promise<void> {
    await this.catalogAsyncJobsService.markProcessing(job.data.asyncJobId, {
      progress: 30,
    });

    try {
      const report = await this.generateCatalogReportUseCase.execute({
        tenantId: job.data.tenantId,
        types: job.data.types,
        categoryIds: job.data.categoryIds,
        query: job.data.query,
        includeInactive: job.data.includeInactive,
      });

      const csv = this.catalogReportCsvBuilder.build(report);
      const fileContent = csv.content;
      let fileUrl: string | undefined;

      try {
        const uploadedUrl = await this.fileStorageService.upload(
          Buffer.from(csv.content, 'utf-8'),
          csv.fileName,
          csv.mimeType,
          { folder: `tenant-${job.data.tenantId}/catalog-reports` },
        );

        if (uploadedUrl) {
          fileUrl = uploadedUrl;
        }
      } catch (error) {
        this.logger.warn(
          `Falling back to database file storage for catalog export ${job.data.asyncJobId}: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        );
      }

      await this.catalogAsyncJobsService.completeJob(job.data.asyncJobId, {
        processedItems: report.items.length,
        totalItems: report.items.length,
        resultSummary: {
          totalItems: report.summary.totalItems,
          activeItems: report.summary.activeItems,
          inactiveItems: report.summary.inactiveItems,
          services: report.summary.services,
          products: report.summary.products,
          rentals: report.summary.rentals,
          estimatedBaseValue: report.summary.estimatedBaseValue,
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
          : 'Falha ao exportar relatorio do catalogo.';
      await this.catalogAsyncJobsService.failJob(job.data.asyncJobId, message);
      throw error;
    }
  }
}
