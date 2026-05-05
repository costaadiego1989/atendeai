import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Response } from 'express';
import { Roles } from '@shared/infrastructure/auth/decorators/roles.decorator';
import { JwtCookieGuard } from '@shared/infrastructure/auth/guards/JwtCookieGuard';
import { RolesGuard } from '@shared/infrastructure/auth/guards/RolesGuard';
import { ProspectingAsyncJobsService } from '../../application/services/ProspectingAsyncJobsService';
import {
  GenerateProspectCampaignReportDTO,
  GenerateProspectSearchReportDTO,
} from '../dtos/ProspectReportDTOs';

@Controller('prospecting/reports')
@UseGuards(JwtCookieGuard, RolesGuard)
export class ProspectReportController {
  constructor(
    private readonly prospectingAsyncJobsService: ProspectingAsyncJobsService,
    @InjectQueue('prospecting-async-jobs')
    private readonly prospectingAsyncQueue: Queue,
  ) {}

  @Post('search-jobs')
  @Roles('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.ACCEPTED)
  async startSearchReportJob(
    @Req() req: any,
    @Body() body: GenerateProspectSearchReportDTO,
  ) {
    const tenantId = req.user.tenantId;
    const asyncJob = await this.prospectingAsyncJobsService.createJob({
      tenantId,
      type: 'EXPORT_PROSPECT_SEARCHES_CSV',
      requestedByUserId: req.user?.sub,
      requestedByUserEmail: req.user?.email,
      payload: {
        query: body.query,
        statuses: body.statuses ?? [],
        sources: body.sources ?? [],
        dateFrom: body.dateFrom,
        dateTo: body.dateTo,
      },
    });

    const queueJob = await this.prospectingAsyncQueue.add(
      'export-prospect-searches-csv',
      {
        asyncJobId: asyncJob.id,
        type: 'EXPORT_PROSPECT_SEARCHES_CSV',
        tenantId,
        query: body.query,
        statuses: body.statuses ?? [],
        sources: body.sources ?? [],
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

    await this.prospectingAsyncJobsService.attachQueueJobId(asyncJob.id, String(queueJob.id));
    return this.prospectingAsyncJobsService.getJob(tenantId, asyncJob.id);
  }

  @Post('campaign-jobs')
  @Roles('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.ACCEPTED)
  async startCampaignReportJob(
    @Req() req: any,
    @Body() body: GenerateProspectCampaignReportDTO,
  ) {
    const tenantId = req.user.tenantId;
    const asyncJob = await this.prospectingAsyncJobsService.createJob({
      tenantId,
      type: 'EXPORT_PROSPECT_CAMPAIGNS_CSV',
      requestedByUserId: req.user?.sub,
      requestedByUserEmail: req.user?.email,
      payload: {
        query: body.query,
        statuses: body.statuses ?? [],
        channels: body.channels ?? [],
        audienceTypes: body.audienceTypes ?? [],
        dateFrom: body.dateFrom,
        dateTo: body.dateTo,
      },
    });

    const queueJob = await this.prospectingAsyncQueue.add(
      'export-prospect-campaigns-csv',
      {
        asyncJobId: asyncJob.id,
        type: 'EXPORT_PROSPECT_CAMPAIGNS_CSV',
        tenantId,
        query: body.query,
        statuses: body.statuses ?? [],
        channels: body.channels ?? [],
        audienceTypes: body.audienceTypes ?? [],
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

    await this.prospectingAsyncJobsService.attachQueueJobId(asyncJob.id, String(queueJob.id));
    return this.prospectingAsyncJobsService.getJob(tenantId, asyncJob.id);
  }

  @Get('jobs')
  @Roles('OWNER', 'ADMIN')
  async listJobs(@Req() req: any) {
    return this.prospectingAsyncJobsService.listJobs(req.user.tenantId);
  }

  @Get('jobs/:jobId')
  @Roles('OWNER', 'ADMIN')
  async getJob(@Req() req: any, @Param('jobId') jobId: string) {
    return this.prospectingAsyncJobsService.getJob(req.user.tenantId, jobId);
  }

  @Get('jobs/:jobId/download')
  @Roles('OWNER', 'ADMIN')
  async downloadJobFile(
    @Req() req: any,
    @Param('jobId') jobId: string,
    @Res() res: Response,
  ) {
    const file = await this.prospectingAsyncJobsService.getDownloadPayload(
      req.user.tenantId,
      jobId,
    );

    if (file.fileContent) {
      res.setHeader('Content-Type', file.fileMimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
      return res.send(file.fileContent);
    }

    if (file.fileUrl) {
      return res.redirect(file.fileUrl);
    }

    res.setHeader('Content-Type', 'text/plain;charset=utf-8');
    return res.status(HttpStatus.NOT_FOUND).send('Arquivo não disponivel.');
  }
}
