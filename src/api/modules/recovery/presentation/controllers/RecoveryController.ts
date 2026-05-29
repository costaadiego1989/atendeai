import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { Roles } from '@shared/infrastructure/auth/decorators/roles.decorator';
import { JwtCookieGuard } from '@shared/infrastructure/auth/guards/JwtCookieGuard';
import { RolesGuard } from '@shared/infrastructure/auth/guards/RolesGuard';
import { TenantGuard } from '@shared/infrastructure/auth/guards/TenantGuard';
import { CreateRecoveryCaseUseCase } from '../../application/use-cases/CreateRecoveryCaseUseCase';
import { RecoveryAsyncJobsService } from '../../application/services/RecoveryAsyncJobsService';
import { GenerateRecoveryPaymentLinkUseCase } from '../../application/use-cases/GenerateRecoveryPaymentLinkUseCase';
import { GenerateRecoveryReportUseCase } from '../../application/use-cases/GenerateRecoveryReportUseCase';
import { GetRecoveryCaseUseCase } from '../../application/use-cases/GetRecoveryCaseUseCase';
import { ListRecoveryCasesUseCase } from '../../application/use-cases/ListRecoveryCasesUseCase';
import { RegenerateRecoveryGuidanceUseCase } from '../../application/use-cases/RegenerateRecoveryGuidanceUseCase';
import { SendRecoveryGuidanceUseCase } from '../../application/use-cases/SendRecoveryGuidanceUseCase';
import { StartRecoveryReportExportUseCase } from '../../application/use-cases/StartRecoveryReportExportUseCase';
import { TriggerRecoveryOutreachUseCase } from '../../application/use-cases/TriggerRecoveryOutreachUseCase';
import { UpdateRecoveryCaseStatusUseCase } from '../../application/use-cases/UpdateRecoveryCaseStatusUseCase';
import {
  CreateRecoveryCaseDTO,
  CreateRecoveryPlaybookDTO,
  GenerateRecoveryReportDTO,
  GenerateRecoveryPaymentLinkDTO,
  RegenerateRecoveryGuidanceDTO,
  ScheduleRecoveryRecurringChargeDTO,
  CancelRecoveryRecurringChargeDTO,
  TriggerRecoveryOutreachDTO,
  UpdateRecoveryCaseStatusDTO,
} from '../dtos/RecoveryDTOs';
import { ListRecoveryPlaybooksUseCase } from '../../application/use-cases/ListRecoveryPlaybooksUseCase';
import { SeedDefaultRecoveryPlaybookUseCase } from '../../application/use-cases/SeedDefaultRecoveryPlaybookUseCase';
import { CreateRecoveryPlaybookUseCase } from '../../application/use-cases/CreateRecoveryPlaybookUseCase';
import { ActivateRecoveryPlaybookUseCase } from '../../application/use-cases/ActivateRecoveryPlaybookUseCase';
import { ScheduleRecoveryRecurringChargeUseCase } from '../../application/use-cases/ScheduleRecoveryRecurringChargeUseCase';
import { ListRecoveryRecurringChargesUseCase } from '../../application/use-cases/ListRecoveryRecurringChargesUseCase';
import { CancelRecoveryRecurringChargeUseCase } from '../../application/use-cases/CancelRecoveryRecurringChargeUseCase';

@Controller('tenants/:tenantId/recovery')
@UseGuards(JwtCookieGuard, RolesGuard, TenantGuard)
export class RecoveryController {
  constructor(
    private readonly createRecoveryCaseUseCase: CreateRecoveryCaseUseCase,
    private readonly generateRecoveryReportUseCase: GenerateRecoveryReportUseCase,
    private readonly recoveryAsyncJobsService: RecoveryAsyncJobsService,
    private readonly generateRecoveryPaymentLinkUseCase: GenerateRecoveryPaymentLinkUseCase,
    private readonly getRecoveryCaseUseCase: GetRecoveryCaseUseCase,
    private readonly listRecoveryCasesUseCase: ListRecoveryCasesUseCase,
    private readonly regenerateRecoveryGuidanceUseCase: RegenerateRecoveryGuidanceUseCase,
    private readonly sendRecoveryGuidanceUseCase: SendRecoveryGuidanceUseCase,
    private readonly scheduleRecoveryRecurringChargeUseCase: ScheduleRecoveryRecurringChargeUseCase,
    private readonly listRecoveryRecurringChargesUseCase: ListRecoveryRecurringChargesUseCase,
    private readonly cancelRecoveryRecurringChargeUseCase: CancelRecoveryRecurringChargeUseCase,
    private readonly listRecoveryPlaybooksUseCase: ListRecoveryPlaybooksUseCase,
    private readonly seedDefaultRecoveryPlaybookUseCase: SeedDefaultRecoveryPlaybookUseCase,
    private readonly createRecoveryPlaybookUseCase: CreateRecoveryPlaybookUseCase,
    private readonly activateRecoveryPlaybookUseCase: ActivateRecoveryPlaybookUseCase,
    private readonly triggerRecoveryOutreachUseCase: TriggerRecoveryOutreachUseCase,
    private readonly updateRecoveryCaseStatusUseCase: UpdateRecoveryCaseStatusUseCase,
    private readonly startRecoveryReportExportUseCase: StartRecoveryReportExportUseCase,
  ) {}

  @Get('playbooks')
  @Roles('OWNER', 'ADMIN')
  async listPlaybooks(@Param('tenantId') tenantId: string) {
    return this.listRecoveryPlaybooksUseCase.execute({ tenantId });
  }

  @Post('playbooks')
  @Roles('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.CREATED)
  async createPlaybook(
    @Param('tenantId') tenantId: string,
    @Body() body: CreateRecoveryPlaybookDTO,
  ) {
    return this.createRecoveryPlaybookUseCase.execute({
      tenantId,
      branchId: body.branchId?.trim() ? body.branchId.trim() : null,
      name: body.name.trim(),
      phases: body.phases.map((p) => ({
        sortOrder: p.sortOrder,
        channel: p.channel,
        minDelayHoursSincePrevious: p.minDelayHoursSincePrevious,
        minDaysOverdue: p.minDaysOverdue,
        mode: p.mode,
        templateBody: p.templateBody ?? null,
      })),
    });
  }

  @Post('playbooks/seed-default')
  @Roles('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  async seedDefaultPlaybook(@Param('tenantId') tenantId: string) {
    return this.seedDefaultRecoveryPlaybookUseCase.execute({ tenantId });
  }

  @Patch('playbooks/:playbookId/activate')
  @Roles('OWNER', 'ADMIN')
  async activatePlaybook(
    @Param('tenantId') tenantId: string,
    @Param('playbookId') playbookId: string,
  ) {
    return this.activateRecoveryPlaybookUseCase.execute({
      tenantId,
      playbookId,
    });
  }

  @Post('cases')
  @Roles('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.CREATED)
  async createCase(
    @Param('tenantId') tenantId: string,
    @Body() body: CreateRecoveryCaseDTO,
  ) {
    return this.createRecoveryCaseUseCase.execute({
      tenantId,
      branchId: body.branchId,
      contactId: body.contactId,
      debtorName: body.debtorName,
      debtorCompanyName: body.debtorCompanyName,
      debtorDocument: body.debtorDocument,
      phone: body.phone,
      chargeType: body.chargeType,
      chargeTitle: body.chargeTitle,
      chargeDescription: body.chargeDescription,
      referencePeriod: body.referencePeriod,
      relatedEntityType: body.relatedEntityType,
      relatedEntityId: body.relatedEntityId,
      relatedEntityLabel: body.relatedEntityLabel,
      amountDue: body.amountDue,
      dueDate: body.dueDate,
      externalReference: body.externalReference,
      assignedTags: body.assignedTags,
    });
  }

  @Get('cases')
  @Roles('OWNER', 'ADMIN')
  async listCases(
    @Param('tenantId') tenantId: string,
    @Query('branchId') branchId?: string,
    @Query('status') status?: string,
    @Query('source') source?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.listRecoveryCasesUseCase.execute({
      tenantId,
      branchId,
      status,
      source,
      dateFrom: this.parseOptionalDate(dateFrom),
      dateTo: this.parseOptionalDate(dateTo),
    });
  }

  @Post('report-jobs')
  @Roles('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.ACCEPTED)
  async startReportJob(
    @Param('tenantId') tenantId: string,
    @Query('branchId') branchId: string | undefined,
    @Body() body: GenerateRecoveryReportDTO,
    @Req() req: any,
  ) {
    return this.startRecoveryReportExportUseCase.execute({
      tenantId,
      branchId,
      statuses: body.statuses,
      sources: body.sources,
      search: body.search,
      dateFrom: body.dateFrom,
      dateTo: body.dateTo,
      requestedByUserId: req.user?.sub,
      requestedByUserEmail: req.user?.email,
    });
  }

  @Get('jobs')
  @Roles('OWNER', 'ADMIN')
  async listJobs(@Param('tenantId') tenantId: string) {
    return this.recoveryAsyncJobsService.listJobs(tenantId);
  }

  @Get('jobs/:jobId')
  @Roles('OWNER', 'ADMIN')
  async getJob(
    @Param('tenantId') tenantId: string,
    @Param('jobId') jobId: string,
  ) {
    return this.recoveryAsyncJobsService.getJob(tenantId, jobId);
  }

  @Get('jobs/:jobId/download')
  @Roles('OWNER', 'ADMIN')
  async downloadJobFile(
    @Param('tenantId') tenantId: string,
    @Param('jobId') jobId: string,
    @Res() res: Response,
  ) {
    const file = await this.recoveryAsyncJobsService.getDownloadPayload(
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

  @Post('reports')
  @Roles('OWNER', 'ADMIN')
  async generateReport(
    @Param('tenantId') tenantId: string,
    @Query('branchId') branchId: string | undefined,
    @Body() body: GenerateRecoveryReportDTO,
  ) {
    return this.generateRecoveryReportUseCase.execute({
      tenantId,
      branchId,
      statuses: body.statuses ?? [],
      sources: body.sources ?? [],
      search: body.search?.trim() || undefined,
      dateFrom: this.parseOptionalDate(body.dateFrom),
      dateTo: this.parseOptionalDate(body.dateTo),
    });
  }

  @Get('cases/:caseId')
  @Roles('OWNER', 'ADMIN')
  async getCase(
    @Param('tenantId') tenantId: string,
    @Param('caseId') caseId: string,
  ) {
    return this.getRecoveryCaseUseCase.execute({
      tenantId,
      caseId,
    });
  }

  @Post('cases/:caseId/outreach')
  @Roles('OWNER', 'ADMIN')
  async triggerOutreach(
    @Param('tenantId') tenantId: string,
    @Param('caseId') caseId: string,
    @Body() body: TriggerRecoveryOutreachDTO,
  ) {
    return this.triggerRecoveryOutreachUseCase.execute({
      tenantId,
      caseId,
      messageText: body.messageText,
      previewOnly: body.previewOnly,
      generateWithAI: body.generateWithAI,
      followPlaybook: body.followPlaybook,
    });
  }

  @Post('cases/:caseId/payment-link')
  @Roles('OWNER', 'ADMIN')
  async generatePaymentLink(
    @Param('tenantId') tenantId: string,
    @Param('caseId') caseId: string,
    @Body() body: GenerateRecoveryPaymentLinkDTO,
  ) {
    return this.generateRecoveryPaymentLinkUseCase.execute({
      tenantId,
      caseId,
      billingType: body.billingType,
    });
  }

  @Post('cases/:caseId/recurring-charges')
  @Roles('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.CREATED)
  async scheduleRecurringCharge(
    @Param('tenantId') tenantId: string,
    @Param('caseId') caseId: string,
    @Body() body: ScheduleRecoveryRecurringChargeDTO,
    @Req() req: any,
  ) {
    return this.scheduleRecoveryRecurringChargeUseCase.execute({
      tenantId,
      caseId,
      billingType: body.billingType ?? 'UNDEFINED',
      intervalDays: body.intervalDays,
      maxOccurrences: body.maxOccurrences,
      firstRunAt: body.firstRunAt ? new Date(body.firstRunAt) : undefined,
      messageTemplate: body.messageTemplate,
      createdByUserId: req.user?.sub,
      createdByUserEmail: req.user?.email,
    });
  }

  private parseOptionalDate(value?: string): Date | undefined {
    if (!value) {
      return undefined;
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  @Get('cases/:caseId/recurring-charges')
  @Roles('OWNER', 'ADMIN')
  async listRecurringCharges(
    @Param('tenantId') tenantId: string,
    @Param('caseId') caseId: string,
  ) {
    return this.listRecoveryRecurringChargesUseCase.execute({
      tenantId,
      caseId,
    });
  }

  @Patch('recurring-charges/:recurrenceId/cancel')
  @Roles('OWNER', 'ADMIN')
  async cancelRecurringCharge(
    @Param('tenantId') tenantId: string,
    @Param('recurrenceId') recurrenceId: string,
    @Body() body: CancelRecoveryRecurringChargeDTO,
  ) {
    return this.cancelRecoveryRecurringChargeUseCase.execute({
      tenantId,
      recurrenceId,
      reason: body.reason,
    });
  }

  @Post('cases/:caseId/guidance')
  @Roles('OWNER', 'ADMIN')
  async regenerateGuidance(
    @Param('tenantId') tenantId: string,
    @Param('caseId') caseId: string,
    @Body() body: RegenerateRecoveryGuidanceDTO,
  ) {
    return this.regenerateRecoveryGuidanceUseCase.execute({
      tenantId,
      caseId,
      customerMessage: body.customerMessage,
    });
  }

  @Post('cases/:caseId/guidance/send')
  @Roles('OWNER', 'ADMIN')
  async sendGuidance(
    @Param('tenantId') tenantId: string,
    @Param('caseId') caseId: string,
  ) {
    return this.sendRecoveryGuidanceUseCase.execute({
      tenantId,
      caseId,
    });
  }

  @Patch('cases/:caseId/status')
  @Roles('OWNER', 'ADMIN')
  async updateCaseStatus(
    @Param('tenantId') tenantId: string,
    @Param('caseId') caseId: string,
    @Body() body: UpdateRecoveryCaseStatusDTO,
  ) {
    return this.updateRecoveryCaseStatusUseCase.execute({
      tenantId,
      caseId,
      status: body.status,
      nextActionAt: body.nextActionAt,
    });
  }
}
