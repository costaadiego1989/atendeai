import { Inject, Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { IUseCase } from '@shared/application/IUseCase';
import {
  CatalogAsyncJobsService,
  CatalogAsyncJobView,
} from '../../infrastructure/persistence/repositories/CatalogAsyncJobsService';
import { CatalogImportParser } from '../services/CatalogImportParser';

export interface EnqueueCatalogImportJobCommand {
  tenantId: string;
  userId?: string;
  userEmail?: string;
  rawText: string;
  defaultType?: 'SERVICE' | 'PRODUCT' | 'RENTAL';
  defaultCategoryName?: string;
  defaultSource?: 'MANUAL' | 'IMPORT' | 'ERP_SNAPSHOT';
  defaultTags?: string[];
  syncInventory?: boolean;
}

@Injectable()
export class EnqueueCatalogImportJobUseCase implements IUseCase<
  EnqueueCatalogImportJobCommand,
  CatalogAsyncJobView
> {
  constructor(
    private readonly catalogAsyncJobsService: CatalogAsyncJobsService,
    private readonly catalogImportParser: CatalogImportParser,
    @InjectQueue('catalog-async-jobs')
    private readonly catalogAsyncQueue: Queue,
  ) {}

  async execute(
    command: EnqueueCatalogImportJobCommand,
  ): Promise<CatalogAsyncJobView> {
    const totalItems = this.catalogImportParser.countRows(command.rawText, {
      defaultType: command.defaultType,
      defaultCategoryName: command.defaultCategoryName,
      defaultSource: command.defaultSource,
      defaultTags: command.defaultTags ?? [],
    });

    const asyncJob = await this.catalogAsyncJobsService.createJob({
      tenantId: command.tenantId,
      type: 'IMPORT_CATALOG_ITEMS',
      requestedByUserId: command.userId,
      requestedByUserEmail: command.userEmail,
      totalItems,
      payload: {
        rawText: command.rawText,
        defaultType: command.defaultType,
        defaultCategoryName: command.defaultCategoryName,
        defaultSource: command.defaultSource,
        defaultTags: command.defaultTags ?? [],
        syncInventory: command.syncInventory ?? false,
      },
    });

    const queueJob = await this.catalogAsyncQueue.add(
      'import-catalog-items',
      {
        asyncJobId: asyncJob.id,
        type: 'IMPORT_CATALOG_ITEMS',
        tenantId: command.tenantId,
        rawText: command.rawText,
        defaultType: command.defaultType,
        defaultCategoryName: command.defaultCategoryName,
        defaultSource: command.defaultSource,
        defaultTags: command.defaultTags ?? [],
        syncInventory: command.syncInventory ?? false,
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
