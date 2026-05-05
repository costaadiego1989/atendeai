import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Response } from 'express';
import { ICreateContactUseCase } from '../../application/use-cases/interfaces/ICreateContactUseCase';
import { IChangeContactStageUseCase } from '../../application/use-cases/interfaces/IChangeContactStageUseCase';
import { IListContactsUseCase } from '../../application/use-cases/interfaces/IListContactsUseCase';
import { IGetContactUseCase } from '../../application/use-cases/interfaces/IGetContactUseCase';
import { IUpdateContactUseCase } from '../../application/use-cases/interfaces/IUpdateContactUseCase';
import { IDeleteContactUseCase } from '../../application/use-cases/interfaces/IDeleteContactUseCase';
import { IGetContactTimelineUseCase } from '../../application/use-cases/interfaces/IGetContactTimelineUseCase';
import { IImportContactsListUseCase } from '../../application/use-cases/interfaces/IImportContactsListUseCase';
import { IGenerateContactsReportUseCase } from '../../application/use-cases/interfaces/IGenerateContactsReportUseCase';
import {
  CreateContactDTO,
  GenerateContactsReportDTO,
  ImportContactsListDTO,
  UpdateContactDTO,
  UpdateContactStageDTO,
} from '../dtos/ContactDTOs';
import { JwtCookieGuard } from '@shared/infrastructure/auth/guards/JwtCookieGuard';
import { TenantGuard } from '@shared/infrastructure/auth/guards/TenantGuard';
import { ContactStage } from '../../domain/value-objects/ContactStage';
import { ContactAsyncJobsService } from '../../application/services/ContactAsyncJobsService';
import { ContactImportParser } from '../../application/services/ContactImportParser';

@Controller('tenants/:tenantId/contacts')
@UseGuards(JwtCookieGuard, TenantGuard)
export class ContactController {
  constructor(
    @Inject(ICreateContactUseCase)
    private readonly createContactUseCase: ICreateContactUseCase,
    @Inject(IChangeContactStageUseCase)
    private readonly changeContactStageUseCase: IChangeContactStageUseCase,
    @Inject(IListContactsUseCase)
    private readonly listContactsUseCase: IListContactsUseCase,
    @Inject(IGetContactUseCase)
    private readonly getContactUseCase: IGetContactUseCase,
    @Inject(IUpdateContactUseCase)
    private readonly updateContactUseCase: IUpdateContactUseCase,
    @Inject(IDeleteContactUseCase)
    private readonly deleteContactUseCase: IDeleteContactUseCase,
    @Inject(IGetContactTimelineUseCase)
    private readonly getContactTimelineUseCase: IGetContactTimelineUseCase,
    @Inject(IImportContactsListUseCase)
    private readonly importContactsListUseCase: IImportContactsListUseCase,
    @Inject(IGenerateContactsReportUseCase)
    private readonly generateContactsReportUseCase: IGenerateContactsReportUseCase,
    private readonly contactAsyncJobsService: ContactAsyncJobsService,
    private readonly contactImportParser: ContactImportParser,
    @InjectQueue('contact-async-jobs')
    private readonly contactAsyncQueue: Queue,
  ) {}

  @Get()
  async list(
    @Param('tenantId') tenantId: string,
    @Query('branchId') branchId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('stage') stage?: string,
    @Query('tag') tag?: string,
  ) {
    return this.listContactsUseCase.execute({
      tenantId,
      branchId,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      stage,
      tag,
    });
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('tenantId') tenantId: string,
    @Body() body: CreateContactDTO,
    @Query('branchId') branchId?: string,
  ) {
    return this.createContactUseCase.execute({ ...body, tenantId, branchId });
  }

  @Post('import')
  @HttpCode(HttpStatus.OK)
  async importList(
    @Param('tenantId') tenantId: string,
    @Body() body: ImportContactsListDTO,
    @Query('branchId') branchId?: string,
  ) {
    return this.importContactsListUseCase.execute({
      tenantId,
      branchId,
      rawText: body.rawText,
      defaultStage: body.defaultStage as any,
      defaultTags: body.defaultTags,
    });
  }

  @Post('import-jobs')
  @HttpCode(HttpStatus.ACCEPTED)
  async startImportJob(
    @Param('tenantId') tenantId: string,
    @Body() body: ImportContactsListDTO,
    @Query('branchId') branchId: string | undefined,
    @Req() req: any,
  ) {
    const totalItems = this.contactImportParser.countRows(body.rawText);

    const asyncJob = await this.contactAsyncJobsService.createJob({
      tenantId,
      branchId,
      type: 'IMPORT_CONTACTS',
      requestedByUserId: req.user?.sub,
      requestedByUserEmail: req.user?.email,
      totalItems,
      payload: {
        branchId,
        defaultStage: body.defaultStage,
        defaultTags: body.defaultTags ?? [],
      },
    });

    const queueJob = await this.contactAsyncQueue.add(
      'import-contacts',
      {
        asyncJobId: asyncJob.id,
        type: 'IMPORT_CONTACTS',
        tenantId,
        branchId,
        rawText: body.rawText,
        defaultStage: body.defaultStage,
        defaultTags: body.defaultTags ?? [],
        totalItems,
      },
      {
        jobId: asyncJob.id,
        attempts: 2,
        removeOnComplete: 50,
        removeOnFail: 200,
      },
    );

    await this.contactAsyncJobsService.attachQueueJobId(asyncJob.id, String(queueJob.id));
    return this.contactAsyncJobsService.getJob(tenantId, asyncJob.id);
  }

  @Post('reports')
  @HttpCode(HttpStatus.OK)
  async generateReport(
    @Param('tenantId') tenantId: string,
    @Body() body: GenerateContactsReportDTO,
    @Query('branchId') branchId?: string,
  ) {
    return this.generateContactsReportUseCase.execute({
      tenantId,
      branchId,
      stages: body.stages,
      tags: body.tags,
      timelineTypes: body.timelineTypes as any,
      channels: body.channels as any,
      dateFrom: body.dateFrom,
      dateTo: body.dateTo,
    });
  }

  @Post('report-jobs')
  @HttpCode(HttpStatus.ACCEPTED)
  async startReportJob(
    @Param('tenantId') tenantId: string,
    @Body() body: GenerateContactsReportDTO,
    @Query('branchId') branchId: string | undefined,
    @Req() req: any,
  ) {
    const asyncJob = await this.contactAsyncJobsService.createJob({
      tenantId,
      branchId,
      type: 'EXPORT_CONTACTS_CSV',
      requestedByUserId: req.user?.sub,
      requestedByUserEmail: req.user?.email,
      payload: {
        branchId,
        stages: body.stages ?? [],
        tags: body.tags ?? [],
        timelineTypes: body.timelineTypes ?? [],
        channels: body.channels ?? [],
        dateFrom: body.dateFrom,
        dateTo: body.dateTo,
      },
    });

    const queueJob = await this.contactAsyncQueue.add(
      'export-contacts-csv',
      {
        asyncJobId: asyncJob.id,
        type: 'EXPORT_CONTACTS_CSV',
        tenantId,
        branchId,
        stages: body.stages ?? [],
        tags: body.tags ?? [],
        timelineTypes: body.timelineTypes as any,
        channels: body.channels as any,
        dateFrom: body.dateFrom,
        dateTo: body.dateTo,
      },
      {
        jobId: asyncJob.id,
        attempts: 2,
        removeOnComplete: 50,
        removeOnFail: 200,
      },
    );

    await this.contactAsyncJobsService.attachQueueJobId(asyncJob.id, String(queueJob.id));
    return this.contactAsyncJobsService.getJob(tenantId, asyncJob.id);
  }

  @Get('jobs')
  async listJobs(@Param('tenantId') tenantId: string) {
    return this.contactAsyncJobsService.listJobs(tenantId);
  }

  @Get('jobs/:jobId')
  async getJob(@Param('tenantId') tenantId: string, @Param('jobId') jobId: string) {
    return this.contactAsyncJobsService.getJob(tenantId, jobId);
  }

  @Get('jobs/:jobId/download')
  async downloadJobFile(
    @Param('tenantId') tenantId: string,
    @Param('jobId') jobId: string,
    @Res() res: Response,
  ) {
    const file = await this.contactAsyncJobsService.getDownloadPayload(tenantId, jobId);

    if (file.fileContent) {
      res.setHeader('Content-Type', file.fileMimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
      return res.send(file.fileContent);
    }

    if (file.fileUrl) {
      return res.redirect(file.fileUrl);
    }

    res.setHeader('Content-Type', 'text/plain;charset=utf-8');
    return res.status(HttpStatus.NOT_FOUND).send('Arquivo não disponível.');
  }

  @Patch(':id/stage')
  async updateStage(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() body: UpdateContactStageDTO,
  ) {
    return this.changeContactStageUseCase.execute({
      tenantId,
      contactId: id,
      newStage: body.stage as ContactStage,
    });
  }

  @Get(':id')
  async getOne(@Param('tenantId') tenantId: string, @Param('id') id: string) {
    return this.getContactUseCase.execute({ tenantId, contactId: id });
  }

  @Get(':id/timeline')
  async timeline(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.getContactTimelineUseCase.execute({
      tenantId,
      contactId: id,
    });
  }

  @Patch(':id')
  async update(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() body: UpdateContactDTO,
  ) {
    return this.updateContactUseCase.execute({
      ...body,
      tenantId,
      contactId: id,
    });
  }

  @Post(':id/delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('tenantId') tenantId: string, @Param('id') id: string) {
    return this.deleteContactUseCase.execute({ tenantId, contactId: id });
  }
}
