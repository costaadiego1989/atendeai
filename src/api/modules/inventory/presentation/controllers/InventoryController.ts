import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
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
import { TenantGuard } from '@shared/infrastructure/auth/guards/TenantGuard';
import { SyncInventoryItemUseCase } from '../../application/use-cases/SyncInventoryItemUseCase';
import { ListInventoryItemsUseCase } from '../../application/use-cases/ListInventoryItemsUseCase';
import { CreateInventoryConnectionUseCase } from '../../application/use-cases/CreateInventoryConnectionUseCase';
import { ListInventoryConnectionsUseCase } from '../../application/use-cases/ListInventoryConnectionsUseCase';
import { SyncInventoryConnectionUseCase } from '../../application/use-cases/SyncInventoryConnectionUseCase';
import {
  CreateInventoryConnectionDTO,
  GenerateInventoryReportDTO,
  SyncInventoryItemDTO,
} from '../dtos/InventoryDTOs';
import { GenerateInventoryReportUseCase } from '../../application/use-cases/GenerateInventoryReportUseCase';
import { InventoryAsyncJobsService } from '../../application/services/InventoryAsyncJobsService';

@Controller('tenants/:tenantId/inventory')
@UseGuards(JwtCookieGuard, RolesGuard, TenantGuard)
export class InventoryController {
  constructor(
    private readonly syncInventoryItemUseCase: SyncInventoryItemUseCase,
    private readonly listInventoryItemsUseCase: ListInventoryItemsUseCase,
    private readonly createInventoryConnectionUseCase: CreateInventoryConnectionUseCase,
    private readonly listInventoryConnectionsUseCase: ListInventoryConnectionsUseCase,
    private readonly syncInventoryConnectionUseCase: SyncInventoryConnectionUseCase,
    private readonly generateInventoryReportUseCase: GenerateInventoryReportUseCase,
    private readonly inventoryAsyncJobsService: InventoryAsyncJobsService,
    @InjectQueue('inventory-async-jobs')
    private readonly inventoryAsyncQueue: Queue,
  ) {}

  @Post('connections')
  @Roles('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.CREATED)
  async createConnection(
    @Param('tenantId') tenantId: string,
    @Body() body: CreateInventoryConnectionDTO,
  ) {
    return this.createInventoryConnectionUseCase.execute({
      tenantId,
      sourceType: body.sourceType,
      providerName: body.providerName,
      config: body.config,
    });
  }

  @Get('connections')
  @Roles('OWNER', 'ADMIN')
  async listConnections(@Param('tenantId') tenantId: string) {
    return this.listInventoryConnectionsUseCase.execute(tenantId);
  }

  @Post('connections/:connectionId/sync')
  @Roles('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.ACCEPTED)
  async syncConnection(
    @Param('tenantId') tenantId: string,
    @Param('connectionId') connectionId: string,
  ) {
    await this.syncInventoryConnectionUseCase.execute({ tenantId, connectionId });
    return { message: 'Sync started', connectionId };
  }

  @Post('items/sync')
  @Roles('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.CREATED)
  async syncItem(
    @Param('tenantId') tenantId: string,
    @Body() body: SyncInventoryItemDTO,
  ) {
    return this.syncInventoryItemUseCase.execute({
      tenantId,
      catalogItemId: body.catalogItemId,
      sku: body.sku,
      externalReference: body.externalReference,
      name: body.name,
      availableQuantity: body.availableQuantity,
      availabilityStatus: body.availabilityStatus,
      currentPrice: body.currentPrice,
      currency: body.currency,
      source: body.source,
    });
  }

  @Get('items')
  @Roles('OWNER', 'ADMIN')
  async listItems(
    @Param('tenantId') tenantId: string,
    @Query('query') query?: string,
    @Query('availableOnly') availableOnly?: string,
  ) {
    return this.listInventoryItemsUseCase.execute({
      tenantId,
      query,
      availableOnly: availableOnly === 'true',
    });
  }

  @Post('reports')
  @Roles('OWNER', 'ADMIN')
  async generateReport(
    @Param('tenantId') tenantId: string,
    @Body() body: GenerateInventoryReportDTO,
  ) {
    return this.generateInventoryReportUseCase.execute({
      tenantId,
      query: body.query,
      availableOnly: body.availableOnly,
      statuses: body.statuses ?? [],
    });
  }

  @Post('report-jobs')
  @Roles('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.ACCEPTED)
  async startReportJob(
    @Param('tenantId') tenantId: string,
    @Body() body: GenerateInventoryReportDTO,
    @Req() req: any,
  ) {
    const asyncJob = await this.inventoryAsyncJobsService.createJob({
      tenantId,
      type: 'EXPORT_INVENTORY_REPORT_CSV',
      requestedByUserId: req.user?.sub,
      requestedByUserEmail: req.user?.email,
      payload: {
        query: body.query,
        availableOnly: body.availableOnly ?? false,
        statuses: body.statuses ?? [],
      },
    });

    const queueJob = await this.inventoryAsyncQueue.add(
      'export-inventory-report-csv',
      {
        asyncJobId: asyncJob.id,
        type: 'EXPORT_INVENTORY_REPORT_CSV',
        tenantId,
        query: body.query,
        availableOnly: body.availableOnly ?? false,
        statuses: body.statuses ?? [],
      },
      {
        jobId: asyncJob.id,
        attempts: 2,
        removeOnComplete: 50,
        removeOnFail: 200,
      },
    );

    await this.inventoryAsyncJobsService.attachQueueJobId(asyncJob.id, String(queueJob.id));
    return this.inventoryAsyncJobsService.getJob(tenantId, asyncJob.id);
  }

  @Get('jobs')
  @Roles('OWNER', 'ADMIN')
  async listJobs(@Param('tenantId') tenantId: string) {
    return this.inventoryAsyncJobsService.listJobs(tenantId);
  }

  @Get('jobs/:jobId')
  @Roles('OWNER', 'ADMIN')
  async getJob(@Param('tenantId') tenantId: string, @Param('jobId') jobId: string) {
    return this.inventoryAsyncJobsService.getJob(tenantId, jobId);
  }

  @Get('jobs/:jobId/download')
  @Roles('OWNER', 'ADMIN')
  async downloadJobFile(
    @Param('tenantId') tenantId: string,
    @Param('jobId') jobId: string,
    @Res() res: Response,
  ) {
    const file = await this.inventoryAsyncJobsService.getDownloadPayload(tenantId, jobId);

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
