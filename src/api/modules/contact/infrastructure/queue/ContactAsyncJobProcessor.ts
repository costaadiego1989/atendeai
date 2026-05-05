import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { FILE_STORAGE_SERVICE, FileStorageService } from '@shared/domain/services/FileStorageService';
import { ContactAsyncJobsService } from '../../application/services/ContactAsyncJobsService';
import { ContactReportCsvBuilder } from '../../application/services/ContactReportCsvBuilder';
import { IGenerateContactsReportUseCase } from '../../application/use-cases/interfaces/IGenerateContactsReportUseCase';
import { IImportContactsListUseCase } from '../../application/use-cases/interfaces/IImportContactsListUseCase';

type ContactAsyncJobPayload =
  | {
      asyncJobId: string;
      type: 'IMPORT_CONTACTS';
      tenantId: string;
      branchId?: string;
      rawText: string;
      defaultStage?: string;
      defaultTags?: string[];
      totalItems?: number;
    }
  | {
      asyncJobId: string;
      type: 'EXPORT_CONTACTS_CSV';
      tenantId: string;
      branchId?: string;
      stages?: string[];
      tags?: string[];
      timelineTypes?: Array<'MESSAGING' | 'RECOVERY' | 'PAYMENT' | 'SCHEDULING'>;
      channels?: Array<'WHATSAPP' | 'INSTAGRAM' | 'CRM'>;
      dateFrom?: string;
      dateTo?: string;
    };

@Processor('contact-async-jobs')
export class ContactAsyncJobProcessor extends WorkerHost {
  private readonly logger = new Logger(ContactAsyncJobProcessor.name);

  constructor(
    private readonly contactAsyncJobsService: ContactAsyncJobsService,
    @Inject(IImportContactsListUseCase)
    private readonly importContactsListUseCase: IImportContactsListUseCase,
    @Inject(IGenerateContactsReportUseCase)
    private readonly generateContactsReportUseCase: IGenerateContactsReportUseCase,
    private readonly contactReportCsvBuilder: ContactReportCsvBuilder,
    @Inject(FILE_STORAGE_SERVICE)
    private readonly fileStorageService: FileStorageService,
  ) {
    super();
  }

  async process(job: Job<ContactAsyncJobPayload>): Promise<void> {
    this.logger.log(`Processing contact async job ${job.name}:${job.id}`);

    if (job.name === 'import-contacts') {
      await this.handleImportJob(job);
      return;
    }

    if (job.name === 'export-contacts-csv') {
      await this.handleExportJob(job);
    }
  }

  private async handleImportJob(job: Job<ContactAsyncJobPayload>): Promise<void> {
    const data = job.data;
    if (data.type !== 'IMPORT_CONTACTS') {
      return;
    }

    await this.contactAsyncJobsService.markProcessing(data.asyncJobId, {
      progress: 15,
      totalItems: data.totalItems,
    });

    try {
      const result = await this.importContactsListUseCase.execute({
        tenantId: data.tenantId,
        branchId: data.branchId,
        rawText: data.rawText,
        defaultStage: data.defaultStage as any,
        defaultTags: data.defaultTags,
      });

      await this.contactAsyncJobsService.completeJob(data.asyncJobId, {
        processedItems: result.totalRows,
        totalItems: result.totalRows,
        resultSummary: {
          totalRows: result.totalRows,
          processed: result.processed,
          created: result.created,
          updated: result.updated,
          skipped: result.skipped,
          failed: result.failed,
          previewItems: result.items.filter((item) => item.status !== 'CREATED').slice(0, 25),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao processar importação.';
      await this.contactAsyncJobsService.failJob(data.asyncJobId, message);
      throw error;
    }
  }

  private async handleExportJob(job: Job<ContactAsyncJobPayload>): Promise<void> {
    const data = job.data;
    if (data.type !== 'EXPORT_CONTACTS_CSV') {
      return;
    }

    await this.contactAsyncJobsService.markProcessing(data.asyncJobId, {
      progress: 25,
    });

    try {
      const report = await this.generateContactsReportUseCase.execute({
        tenantId: data.tenantId,
        branchId: data.branchId,
        stages: data.stages,
        tags: data.tags,
        timelineTypes: data.timelineTypes,
        channels: data.channels,
        dateFrom: data.dateFrom,
        dateTo: data.dateTo,
      });

      const csv = this.contactReportCsvBuilder.build(report);
      let fileUrl: string | undefined;
      const fileContent = csv.content;

      try {
        const uploadedUrl = await this.fileStorageService.upload(
          Buffer.from(csv.content, 'utf-8'),
          csv.fileName,
          csv.mimeType,
          { folder: `tenant-${data.tenantId}/contacts-reports` },
        );

        if (uploadedUrl) {
          fileUrl = uploadedUrl;
        }
      } catch (error) {
        this.logger.warn(
          `Falling back to database file storage for contact export ${data.asyncJobId}: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        );
      }

      await this.contactAsyncJobsService.completeJob(data.asyncJobId, {
        processedItems: report.contacts.length,
        totalItems: report.contacts.length,
        resultSummary: {
          totalContacts: report.summary.totalContacts,
          contactsWithTimelineMatch: report.summary.contactsWithTimelineMatch,
          totalTimelineEvents: report.summary.totalTimelineEvents,
        },
        fileName: csv.fileName,
        fileMimeType: csv.mimeType,
        fileUrl,
        fileContent,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao gerar exportação.';
      await this.contactAsyncJobsService.failJob(data.asyncJobId, message);
      throw error;
    }
  }
}
