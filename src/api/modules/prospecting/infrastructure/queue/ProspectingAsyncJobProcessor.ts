import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  FILE_STORAGE_SERVICE,
  FileStorageService,
} from '@shared/domain/services/FileStorageService';
import { ProspectReportCsvBuilder } from '../../application/services/ProspectReportCsvBuilder';
import { ProspectingAsyncJobsService } from '../../application/services/ProspectingAsyncJobsService';
import { GenerateProspectCampaignReportUseCase } from '../../application/use-cases/GenerateProspectCampaignReportUseCase';
import { GenerateProspectSearchReportUseCase } from '../../application/use-cases/GenerateProspectSearchReportUseCase';
import { StructuredLogEmitter } from '@shared/infrastructure/observability/StructuredLogEmitter';

type ProspectingAsyncJobPayload =
  | {
      asyncJobId: string;
      type: 'EXPORT_PROSPECT_SEARCHES_CSV';
      tenantId: string;
      query?: string;
      statuses?: string[];
      sources?: string[];
      dateFrom?: string;
      dateTo?: string;
    }
  | {
      asyncJobId: string;
      type: 'EXPORT_PROSPECT_CAMPAIGNS_CSV';
      tenantId: string;
      query?: string;
      statuses?: string[];
      channels?: string[];
      audienceTypes?: string[];
      dateFrom?: string;
      dateTo?: string;
    };

@Processor('prospecting-async-jobs')
export class ProspectingAsyncJobProcessor extends WorkerHost {
  private readonly logger = new Logger(ProspectingAsyncJobProcessor.name);

  constructor(
    private readonly prospectingAsyncJobsService: ProspectingAsyncJobsService,
    private readonly generateProspectSearchReportUseCase: GenerateProspectSearchReportUseCase,
    private readonly generateProspectCampaignReportUseCase: GenerateProspectCampaignReportUseCase,
    private readonly prospectReportCsvBuilder: ProspectReportCsvBuilder,
    @Inject(FILE_STORAGE_SERVICE)
    private readonly fileStorageService: FileStorageService,
    private readonly structuredLog: StructuredLogEmitter,
  ) {
    super();
  }

  async process(job: Job<ProspectingAsyncJobPayload>): Promise<void> {
    const bullJobId =
      typeof job.id === 'string'
        ? job.id
        : job.id !== undefined && job.id !== null
          ? String(job.id)
          : '';

    this.structuredLog.emit({
      level: 'info',
      event: 'prospecting.async_export.started',
      message: 'Start of asynchronous prospecting export job',
      tenantId: job.data.tenantId,
      attributes: {
        bull_job_id: bullJobId,
        async_job_id: job.data.asyncJobId,
        job_name: job.name ?? '',
        export_type: job.data.type,
      },
    });

    await this.prospectingAsyncJobsService.markProcessing(job.data.asyncJobId, {
      progress: 30,
    });

    try {
      if (
        job.name === 'export-prospect-searches-csv' &&
        job.data.type === 'EXPORT_PROSPECT_SEARCHES_CSV'
      ) {
        const report = await this.generateProspectSearchReportUseCase.execute({
          tenantId: job.data.tenantId,
          query: job.data.query,
          statuses: job.data.statuses as Array<'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED'>,
          sources: job.data.sources as Array<'GOOGLE_PLACES' | 'GOOGLE_ADS_AUDIENCE'>,
          dateFrom: job.data.dateFrom,
          dateTo: job.data.dateTo,
        });
        const csv = this.prospectReportCsvBuilder.buildSearches(report);
        const fileUpload = await this.tryUpload(
          csv,
          job.data.tenantId,
          'search-reports',
          job.data.asyncJobId,
        );

        await this.prospectingAsyncJobsService.completeJob(job.data.asyncJobId, {
          processedItems: report.rows.length,
          totalItems: report.rows.length,
          resultSummary: report.summary,
          fileName: csv.fileName,
          fileMimeType: csv.mimeType,
          fileUrl: fileUpload.fileUrl,
          fileContent: fileUpload.fileContent,
        });
        this.structuredLog.emit({
          level: 'info',
          event: 'prospecting.async_export.completed',
          message: 'Export CSV of searches completed',
          tenantId: job.data.tenantId,
          attributes: {
            bull_job_id: bullJobId,
            async_job_id: job.data.asyncJobId,
            row_count: report.rows.length,
            had_file_url: Boolean(fileUpload.fileUrl),
          },
        });
        return;
      }

      if (
        job.name === 'export-prospect-campaigns-csv' &&
        job.data.type === 'EXPORT_PROSPECT_CAMPAIGNS_CSV'
      ) {
        const report = await this.generateProspectCampaignReportUseCase.execute({
          tenantId: job.data.tenantId,
          query: job.data.query,
          statuses: job.data.statuses as Array<'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED'>,
          channels: job.data.channels as Array<'WHATSAPP' | 'INSTAGRAM'>,
          audienceTypes: job.data.audienceTypes as Array<'REENGAGEMENT' | 'CONTACT_LIST'>,
          dateFrom: job.data.dateFrom,
          dateTo: job.data.dateTo,
        });
        const csv = this.prospectReportCsvBuilder.buildCampaigns(report);
        const fileUpload = await this.tryUpload(
          csv,
          job.data.tenantId,
          'campaign-reports',
          job.data.asyncJobId,
        );

        await this.prospectingAsyncJobsService.completeJob(job.data.asyncJobId, {
          processedItems: report.rows.length,
          totalItems: report.rows.length,
          resultSummary: report.summary,
          fileName: csv.fileName,
          fileMimeType: csv.mimeType,
          fileUrl: fileUpload.fileUrl,
          fileContent: fileUpload.fileContent,
        });
        this.structuredLog.emit({
          level: 'info',
          event: 'prospecting.async_export.completed',
          message: 'Export CSV of campaigns completed',
          tenantId: job.data.tenantId,
          attributes: {
            bull_job_id: bullJobId,
            async_job_id: job.data.asyncJobId,
            row_count: report.rows.length,
            had_file_url: Boolean(fileUpload.fileUrl),
          },
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to generate prospecting report.';
      this.structuredLog.emit({
        level: 'error',
        event: 'prospecting.async_export.failed',
        message,
        tenantId: job.data.tenantId,
        attributes: {
          bull_job_id: bullJobId,
          async_job_id: job.data.asyncJobId,
          export_type: job.data.type,
        },
      });
      await this.prospectingAsyncJobsService.failJob(job.data.asyncJobId, message);
      throw error;
    }
  }

  private async tryUpload(
    csv: { fileName: string; mimeType: string; content: string },
    tenantId: string,
    folderSuffix: string,
    asyncJobId: string,
  ) {
    let fileUrl: string | undefined;
    const fileContent = csv.content;

    try {
      const uploadedUrl = await this.fileStorageService.upload(
        Buffer.from(csv.content, 'utf-8'),
        csv.fileName,
        csv.mimeType,
        { folder: `tenant-${tenantId}/prospecting/${folderSuffix}` },
      );

      if (uploadedUrl) {
        fileUrl = uploadedUrl;
      }
    } catch (error) {
      this.logger.warn(
        `Falling back to database file storage for prospecting export ${asyncJobId}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }

    return { fileUrl, fileContent };
  }
}
