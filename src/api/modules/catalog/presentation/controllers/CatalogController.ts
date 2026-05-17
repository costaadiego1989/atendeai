import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query,
  Req,
  Res,
  Put,
  UseGuards,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Roles } from '@shared/infrastructure/auth/decorators/roles.decorator';
import { JwtCookieGuard } from '@shared/infrastructure/auth/guards/JwtCookieGuard';
import { RolesGuard } from '@shared/infrastructure/auth/guards/RolesGuard';
import { TenantGuard } from '@shared/infrastructure/auth/guards/TenantGuard';
import { Response, Express } from 'express';
import { CreateCatalogCategoryUseCase } from '../../application/use-cases/CreateCatalogCategoryUseCase';
import { ListCatalogCategoriesUseCase } from '../../application/use-cases/ListCatalogCategoriesUseCase';
import { CreateCatalogItemUseCase } from '../../application/use-cases/CreateCatalogItemUseCase';
import { ListCatalogItemsUseCase } from '../../application/use-cases/ListCatalogItemsUseCase';
import { DeactivateCatalogItemUseCase } from '../../application/use-cases/DeactivateCatalogItemUseCase';
import { UpdateCatalogCategoryUseCase } from '../../application/use-cases/UpdateCatalogCategoryUseCase';
import { DeactivateCatalogCategoryUseCase } from '../../application/use-cases/DeactivateCatalogCategoryUseCase';
import { UpdateCatalogItemUseCase } from '../../application/use-cases/UpdateCatalogItemUseCase';
import {
  CreateCatalogCategoryDTO,
  CreateCatalogItemDTO,
  GenerateCatalogReportDTO,
  ImportCatalogItemsDTO,
  UpdateCatalogCategoryDTO,
  UpdateCatalogItemDTO,
} from '../dtos/CatalogDTOs';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadedFile, UseInterceptors } from '@nestjs/common';
import {
  FILE_STORAGE_SERVICE,
  FileStorageService,
} from '@shared/domain/services/FileStorageService';
import { GenerateCatalogReportUseCase } from '../../application/use-cases/GenerateCatalogReportUseCase';
import { CatalogAsyncJobsService } from '../../application/services/CatalogAsyncJobsService';
import { CatalogImportParser } from '../../application/services/CatalogImportParser';

@Controller('tenants/:tenantId/catalog')
@UseGuards(JwtCookieGuard, RolesGuard, TenantGuard)
export class CatalogController {
  constructor(
    private readonly createCatalogCategoryUseCase: CreateCatalogCategoryUseCase,
    private readonly listCatalogCategoriesUseCase: ListCatalogCategoriesUseCase,
    private readonly createCatalogItemUseCase: CreateCatalogItemUseCase,
    private readonly listCatalogItemsUseCase: ListCatalogItemsUseCase,
    private readonly deactivateCatalogItemUseCase: DeactivateCatalogItemUseCase,
    private readonly updateCatalogCategoryUseCase: UpdateCatalogCategoryUseCase,
    private readonly deactivateCatalogCategoryUseCase: DeactivateCatalogCategoryUseCase,
    private readonly updateCatalogItemUseCase: UpdateCatalogItemUseCase,
    private readonly generateCatalogReportUseCase: GenerateCatalogReportUseCase,
    private readonly catalogAsyncJobsService: CatalogAsyncJobsService,
    private readonly catalogImportParser: CatalogImportParser,
    @Inject(FILE_STORAGE_SERVICE)
    private readonly storageService: FileStorageService,
    @InjectQueue('catalog-async-jobs')
    private readonly catalogAsyncQueue: Queue,
  ) {}

  @Post('categories')
  @Roles('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.CREATED)
  async createCategory(
    @Param('tenantId') tenantId: string,
    @Body() body: CreateCatalogCategoryDTO,
  ) {
    return this.createCatalogCategoryUseCase.execute({
      tenantId,
      parentCategoryId: body.parentCategoryId,
      name: body.name,
      description: body.description,
    });
  }

  @Get('categories')
  @Roles('OWNER', 'ADMIN')
  async listCategories(@Param('tenantId') tenantId: string) {
    return this.listCatalogCategoriesUseCase.execute(tenantId);
  }

  @Put('categories/:categoryId')
  @Roles('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  async updateCategory(
    @Param('tenantId') tenantId: string,
    @Param('categoryId') categoryId: string,
    @Body() body: UpdateCatalogCategoryDTO,
  ) {
    return this.updateCatalogCategoryUseCase.execute({
      tenantId,
      categoryId,
      parentCategoryId: body.parentCategoryId,
      name: body.name,
      description: body.description,
    });
  }

  @Delete('categories/:categoryId')
  @Roles('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  async deactivateCategory(
    @Param('tenantId') tenantId: string,
    @Param('categoryId') categoryId: string,
  ) {
    return this.deactivateCatalogCategoryUseCase.execute({
      tenantId,
      categoryId,
    });
  }

  @Post('items')
  @Roles('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.CREATED)
  async createItem(
    @Param('tenantId') tenantId: string,
    @Body() body: CreateCatalogItemDTO,
  ) {
    return this.createCatalogItemUseCase.execute({
      tenantId,
      categoryId: body.categoryId,
      type: body.type,
      name: body.name,
      description: body.description,
      basePrice: body.basePrice,
      currency: body.currency,
      tags: body.tags,
      source: body.source,
      externalReference: body.externalReference,
      imageUrl: body.imageUrl,
      initialStock: body.initialStock,
      attributes: body.attributes,
      variants: body.variants,
      optionGroups: body.optionGroups,
    });
  }

  @Get('items')
  @Roles('OWNER', 'ADMIN')
  async listItems(
    @Param('tenantId') tenantId: string,
    @Query('type') type?: string,
    @Query('categoryId') categoryId?: string,
    @Query('query') query?: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.listCatalogItemsUseCase.execute({
      tenantId,
      type,
      categoryId,
      query,
      includeInactive: includeInactive === 'true',
    });
  }

  @Post('reports')
  @Roles('OWNER', 'ADMIN')
  async generateReport(
    @Param('tenantId') tenantId: string,
    @Body() body: GenerateCatalogReportDTO,
  ) {
    return this.generateCatalogReportUseCase.execute({
      tenantId,
      types: body.types,
      categoryIds: body.categoryIds,
      query: body.query,
      includeInactive: body.includeInactive,
    });
  }

  @Post('report-jobs')
  @Roles('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.ACCEPTED)
  async startReportJob(
    @Param('tenantId') tenantId: string,
    @Body() body: GenerateCatalogReportDTO,
    @Req() req: any,
  ) {
    const asyncJob = await this.catalogAsyncJobsService.createJob({
      tenantId,
      type: 'EXPORT_CATALOG_REPORT_CSV',
      requestedByUserId: req.user?.sub,
      requestedByUserEmail: req.user?.email,
      payload: {
        types: body.types ?? [],
        categoryIds: body.categoryIds ?? [],
        query: body.query,
        includeInactive: body.includeInactive ?? false,
      },
    });

    const queueJob = await this.catalogAsyncQueue.add(
      'export-catalog-report-csv',
      {
        asyncJobId: asyncJob.id,
        type: 'EXPORT_CATALOG_REPORT_CSV',
        tenantId,
        types: body.types ?? [],
        categoryIds: body.categoryIds ?? [],
        query: body.query,
        includeInactive: body.includeInactive ?? false,
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
    return this.catalogAsyncJobsService.getJob(tenantId, asyncJob.id);
  }

  @Post('import-jobs')
  @Roles('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.ACCEPTED)
  async startImportJob(
    @Param('tenantId') tenantId: string,
    @Body() body: ImportCatalogItemsDTO,
    @Req() req: any,
  ) {
    const totalItems = this.catalogImportParser.countRows(body.rawText, {
      defaultType: body.defaultType,
      defaultCategoryName: body.defaultCategoryName,
      defaultSource: body.defaultSource,
      defaultTags: body.defaultTags ?? [],
    });

    const asyncJob = await this.catalogAsyncJobsService.createJob({
      tenantId,
      type: 'IMPORT_CATALOG_ITEMS',
      requestedByUserId: req.user?.sub,
      requestedByUserEmail: req.user?.email,
      totalItems,
      payload: {
        rawText: body.rawText,
        defaultType: body.defaultType,
        defaultCategoryName: body.defaultCategoryName,
        defaultSource: body.defaultSource,
        defaultTags: body.defaultTags ?? [],
        syncInventory: body.syncInventory ?? false,
      },
    });

    const queueJob = await this.catalogAsyncQueue.add(
      'import-catalog-items',
      {
        asyncJobId: asyncJob.id,
        type: 'IMPORT_CATALOG_ITEMS',
        tenantId,
        rawText: body.rawText,
        defaultType: body.defaultType,
        defaultCategoryName: body.defaultCategoryName,
        defaultSource: body.defaultSource,
        defaultTags: body.defaultTags ?? [],
        syncInventory: body.syncInventory ?? false,
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
    return this.catalogAsyncJobsService.getJob(tenantId, asyncJob.id);
  }

  @Get('jobs')
  @Roles('OWNER', 'ADMIN')
  async listJobs(@Param('tenantId') tenantId: string) {
    return this.catalogAsyncJobsService.listJobs(tenantId);
  }

  @Get('jobs/:jobId')
  @Roles('OWNER', 'ADMIN')
  async getJob(
    @Param('tenantId') tenantId: string,
    @Param('jobId') jobId: string,
  ) {
    return this.catalogAsyncJobsService.getJob(tenantId, jobId);
  }

  @Get('jobs/:jobId/download')
  @Roles('OWNER', 'ADMIN')
  async downloadJobFile(
    @Param('tenantId') tenantId: string,
    @Param('jobId') jobId: string,
    @Res() res: Response,
  ) {
    const file = await this.catalogAsyncJobsService.getDownloadPayload(
      tenantId,
      jobId,
    );

    if (file.fileContent) {
      res.setHeader('Content-Type', file.fileMimeType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${file.fileName}"`,
      );
      return res.send(file.fileContent);
    }

    if (file.fileUrl) {
      return res.redirect(file.fileUrl);
    }

    res.setHeader('Content-Type', 'text/plain;charset=utf-8');
    return res.status(HttpStatus.NOT_FOUND).send('Arquivo não disponivel.');
  }

  @Put('items/:itemId')
  @Roles('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  async updateItem(
    @Param('tenantId') tenantId: string,
    @Param('itemId') itemId: string,
    @Body() body: UpdateCatalogItemDTO,
  ) {
    return this.updateCatalogItemUseCase.execute({
      tenantId,
      itemId,
      categoryId: body.categoryId,
      type: body.type,
      name: body.name,
      description: body.description,
      basePrice: body.basePrice,
      currency: body.currency,
      tags: body.tags,
      externalReference: body.externalReference,
      imageUrl: body.imageUrl,
      attributes: body.attributes,
      variants: body.variants,
      optionGroups: body.optionGroups,
    });
  }

  @Post('items/:itemId/deactivate')
  @Roles('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  async deactivateItem(
    @Param('tenantId') tenantId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.deactivateCatalogItemUseCase.execute({
      tenantId,
      itemId,
    });
  }

  @Delete('items/:itemId')
  @Roles('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  async deleteItem(
    @Param('tenantId') tenantId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.deactivateCatalogItemUseCase.execute({
      tenantId,
      itemId,
    });
  }

  @Post('upload')
  @Roles('OWNER', 'ADMIN')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @Param('tenantId') tenantId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const imageUrl = await this.storageService.upload(
      file.buffer,
      file.originalname,
      file.mimetype,
      { folder: `catalog/${tenantId}`, isPublic: true },
    );

    return { imageUrl };
  }
}
