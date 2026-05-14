import {
  Body,
  Controller,
  Delete,
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
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Response } from 'express';
import { JwtCookieGuard } from '@shared/infrastructure/auth/guards/JwtCookieGuard';
import { RolesGuard } from '@shared/infrastructure/auth/guards/RolesGuard';
import { TenantGuard } from '@shared/infrastructure/auth/guards/TenantGuard';
import { Roles } from '@shared/infrastructure/auth/decorators/roles.decorator';
import { CreateSchedulingProfessionalUseCase } from '../../application/use-cases/CreateSchedulingProfessionalUseCase';
import { ListSchedulingProfessionalsUseCase } from '../../application/use-cases/ListSchedulingProfessionalsUseCase';
import { SetProfessionalAvailabilityUseCase } from '../../application/use-cases/SetProfessionalAvailabilityUseCase';
import { GetProfessionalAvailabilityUseCase } from '../../application/use-cases/GetProfessionalAvailabilityUseCase';
import { ReserveProfessionalSlotUseCase } from '../../application/use-cases/ReserveProfessionalSlotUseCase';
import { CreateSchedulingCategoryUseCase } from '../../application/use-cases/CreateSchedulingCategoryUseCase';
import { ListSchedulingCategoriesUseCase } from '../../application/use-cases/ListSchedulingCategoriesUseCase';
import { AssignProfessionalCategoriesUseCase } from '../../application/use-cases/AssignProfessionalCategoriesUseCase';
import { ListCategoryProfessionalsUseCase } from '../../application/use-cases/ListCategoryProfessionalsUseCase';
import { GetCategoryAvailabilityUseCase } from '../../application/use-cases/GetCategoryAvailabilityUseCase';
import { UpdateAvailabilitySlotUseCase } from '../../application/use-cases/UpdateAvailabilitySlotUseCase';
import { GenerateSchedulingPaymentLinkUseCase } from '../../application/use-cases/GenerateSchedulingPaymentLinkUseCase';
import { RescheduleSchedulingReservationUseCase } from '../../application/use-cases/RescheduleSchedulingReservationUseCase';
import { CreateSchedulingRecurrenceUseCase } from '../../application/use-cases/CreateSchedulingRecurrenceUseCase';
import { ListSchedulingRecurrencesUseCase } from '../../application/use-cases/ListSchedulingRecurrencesUseCase';
import { CancelSchedulingRecurrenceUseCase } from '../../application/use-cases/CancelSchedulingRecurrenceUseCase';
import { DeleteSchedulingRecurrenceUseCase } from '../../application/use-cases/DeleteSchedulingRecurrenceUseCase';
import { ProcessSchedulingRecurringReservationUseCase } from '../../application/use-cases/ProcessSchedulingRecurringReservationUseCase';
import { JoinSchedulingMeetingUseCase } from '../../application/use-cases/JoinSchedulingMeetingUseCase';
import {
  AssignProfessionalCategoriesDTO,
  CancelSchedulingRecurrenceDTO,
  CreateSchedulingRecurrenceDTO,
  CreateSchedulingCategoryDTO,
  CreateSchedulingProfessionalDTO,
  GenerateSchedulingReportDTO,
  GenerateSchedulingPaymentLinkDTO,
  RescheduleSchedulingReservationDTO,
  ReserveProfessionalSlotDTO,
  SetProfessionalAvailabilityDTO,
  UpdateAvailabilitySlotDTO,
} from '../dtos/SchedulingDTOs';
import { SchedulingAsyncJobsService } from '../../application/services/SchedulingAsyncJobsService';
import { GenerateSchedulingReportUseCase } from '../../application/use-cases/GenerateSchedulingReportUseCase';

@Controller('tenants/:tenantId/scheduling')
@UseGuards(JwtCookieGuard, RolesGuard, TenantGuard)
export class SchedulingController {
  constructor(
    private readonly createSchedulingProfessionalUseCase: CreateSchedulingProfessionalUseCase,
    private readonly listSchedulingProfessionalsUseCase: ListSchedulingProfessionalsUseCase,
    private readonly createSchedulingCategoryUseCase: CreateSchedulingCategoryUseCase,
    private readonly listSchedulingCategoriesUseCase: ListSchedulingCategoriesUseCase,
    private readonly assignProfessionalCategoriesUseCase: AssignProfessionalCategoriesUseCase,
    private readonly listCategoryProfessionalsUseCase: ListCategoryProfessionalsUseCase,
    private readonly getCategoryAvailabilityUseCase: GetCategoryAvailabilityUseCase,
    private readonly setProfessionalAvailabilityUseCase: SetProfessionalAvailabilityUseCase,
    private readonly getProfessionalAvailabilityUseCase: GetProfessionalAvailabilityUseCase,
    private readonly reserveProfessionalSlotUseCase: ReserveProfessionalSlotUseCase,
    private readonly updateAvailabilitySlotUseCase: UpdateAvailabilitySlotUseCase,
    private readonly rescheduleSchedulingReservationUseCase: RescheduleSchedulingReservationUseCase,
    private readonly generateSchedulingPaymentLinkUseCase: GenerateSchedulingPaymentLinkUseCase,
    private readonly generateSchedulingReportUseCase: GenerateSchedulingReportUseCase,
    private readonly createSchedulingRecurrenceUseCase: CreateSchedulingRecurrenceUseCase,
    private readonly listSchedulingRecurrencesUseCase: ListSchedulingRecurrencesUseCase,
    private readonly cancelSchedulingRecurrenceUseCase: CancelSchedulingRecurrenceUseCase,
    private readonly deleteSchedulingRecurrenceUseCase: DeleteSchedulingRecurrenceUseCase,
    private readonly processSchedulingRecurringReservationUseCase: ProcessSchedulingRecurringReservationUseCase,
    private readonly joinSchedulingMeetingUseCase: JoinSchedulingMeetingUseCase,
    private readonly schedulingAsyncJobsService: SchedulingAsyncJobsService,
    @InjectQueue('scheduling-async-jobs')
    private readonly schedulingAsyncQueue: Queue,
  ) {}

  @Get('recurrences')
  @Roles('OWNER', 'ADMIN')
  async listRecurrences(
    @Param('tenantId') tenantId: string,
    @Query('professionalId') professionalId?: string,
    @Query('status') status?: 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'FAILED',
  ) {
    return this.listSchedulingRecurrencesUseCase.execute({
      tenantId,
      professionalId,
      status,
    });
  }

  @Post('recurrences')
  @Roles('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.CREATED)
  async createRecurrence(
    @Param('tenantId') tenantId: string,
    @Query('branchId') branchId: string | undefined,
    @Body() body: CreateSchedulingRecurrenceDTO,
  ) {
    const recurrence = await this.createSchedulingRecurrenceUseCase.execute({
      tenantId,
      branchId,
      professionalId: body.professionalId,
      contactId: body.contactId,
      categoryId: body.categoryId,
      startDate: body.startDate,
      endDate: body.endDate,
      maxOccurrences: body.maxOccurrences,
      startsAt: body.startsAt,
      endsAt: body.endsAt,
      frequency: body.frequency,
      interval: body.interval,
      isFree: body.isFree,
      isOnline: body.isOnline,
      paymentTimeoutHours: body.paymentTimeoutHours,
      notes: body.notes,
    });

    for (let occurrence = 0; occurrence < recurrence.maxOccurrences; occurrence += 1) {
      await this.processSchedulingRecurringReservationUseCase.execute({
        tenantId,
        recurrenceId: recurrence.id,
      });
    }

    return recurrence;
  }

  @Patch('recurrences/:recurrenceId/cancel')
  @Roles('OWNER', 'ADMIN')
  async cancelRecurrence(
    @Param('tenantId') tenantId: string,
    @Param('recurrenceId') recurrenceId: string,
    @Body() body: CancelSchedulingRecurrenceDTO,
  ) {
    return this.cancelSchedulingRecurrenceUseCase.execute({
      tenantId,
      recurrenceId,
      reason: body.reason,
    });
  }

  @Delete('recurrences/:recurrenceId')
  @Roles('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteRecurrence(
    @Param('tenantId') tenantId: string,
    @Param('recurrenceId') recurrenceId: string,
  ) {
    await this.deleteSchedulingRecurrenceUseCase.execute({
      tenantId,
      recurrenceId,
    });
  }

  @Post('professionals')
  @Roles('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.CREATED)
  async createProfessional(
    @Param('tenantId') tenantId: string,
    @Query('branchId') branchId: string | undefined,
    @Body() body: CreateSchedulingProfessionalDTO,
  ) {
    return this.createSchedulingProfessionalUseCase.execute({
      tenantId,
      branchId,
      name: body.name,
      phone: body.phone,
      role: body.role,
    });
  }

  @Get('professionals')
  @Roles('OWNER', 'ADMIN')
  async listProfessionals(
    @Param('tenantId') tenantId: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.listSchedulingProfessionalsUseCase.execute(tenantId, branchId);
  }

  @Post('categories')
  @Roles('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.CREATED)
  async createCategory(
    @Param('tenantId') tenantId: string,
    @Query('branchId') branchId: string | undefined,
    @Body() body: CreateSchedulingCategoryDTO,
  ) {
    return this.createSchedulingCategoryUseCase.execute({
      tenantId,
      branchId,
      name: body.name,
      unit: body.unit,
      durationMinutes: body.durationMinutes,
      basePrice: body.basePrice,
    });
  }

  @Get('categories')
  @Roles('OWNER', 'ADMIN')
  async listCategories(
    @Param('tenantId') tenantId: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.listSchedulingCategoriesUseCase.execute(tenantId, branchId);
  }

  @Post('professionals/:professionalId/availability')
  @Roles('OWNER', 'ADMIN')
  async setAvailability(
    @Param('tenantId') tenantId: string,
    @Param('professionalId') professionalId: string,
    @Body() body: SetProfessionalAvailabilityDTO,
  ) {
    return this.setProfessionalAvailabilityUseCase.execute({
      tenantId,
      professionalId,
      date: body.date,
      slots: body.slots.map((slot) => ({
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        label: slot.label,
        customPrice: slot.customPrice,
        isOnline: slot.isOnline,
      })),
    });
  }

  @Post('professionals/:professionalId/categories')
  @Roles('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.CREATED)
  async assignCategories(
    @Param('tenantId') tenantId: string,
    @Param('professionalId') professionalId: string,
    @Body() body: AssignProfessionalCategoriesDTO,
  ) {
    return this.assignProfessionalCategoriesUseCase.execute({
      tenantId,
      professionalId,
      categoryIds: body.categoryIds,
    });
  }

  @Get('professionals/:professionalId/availability')
  @Roles('OWNER', 'ADMIN')
  async getAvailability(
    @Param('tenantId') tenantId: string,
    @Param('professionalId') professionalId: string,
    @Query('date') date: string,
  ) {
    return this.getProfessionalAvailabilityUseCase.execute({
      tenantId,
      professionalId,
      date,
    });
  }

  @Get('categories/:categoryId/professionals')
  @Roles('OWNER', 'ADMIN')
  async listCategoryProfessionals(
    @Param('tenantId') tenantId: string,
    @Param('categoryId') categoryId: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.listCategoryProfessionalsUseCase.execute({
      tenantId,
      categoryId,
      branchId,
    });
  }

  @Get('categories/:categoryId/availability')
  @Roles('OWNER', 'ADMIN')
  async getCategoryAvailability(
    @Param('tenantId') tenantId: string,
    @Param('categoryId') categoryId: string,
    @Query('date') date: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.getCategoryAvailabilityUseCase.execute({
      tenantId,
      categoryId,
      date,
      branchId,
    });
  }

  @Post('professionals/:professionalId/availability/reservations')
  @Roles('OWNER', 'ADMIN')
  async reserveAvailability(
    @Param('tenantId') tenantId: string,
    @Query('branchId') branchId: string | undefined,
    @Param('professionalId') professionalId: string,
    @Body() body: ReserveProfessionalSlotDTO,
  ) {
    return this.reserveProfessionalSlotUseCase.execute({
      tenantId,
      branchId,
      professionalId,
      date: body.date,
      slotId: body.slotId,
      contactId: body.contactId,
      categoryId: body.categoryId,
      conversationId: body.conversationId,
      notes: body.notes,
      isFree: body.isFree,
      isOnline: body.isOnline,
      isRecurring: body.isRecurring,
      recurrencePeriod: body.recurrencePeriod,
      recurrenceInterval: body.recurrenceInterval,
      recurrenceOccurrences: body.recurrenceOccurrences,
      paymentTimeoutHours: body.paymentTimeoutHours,
    });
  }

  @Patch('professionals/:professionalId/availability/slots/:slotId')
  @Roles('OWNER', 'ADMIN')
  async updateAvailabilitySlot(
    @Param('tenantId') tenantId: string,
    @Query('branchId') branchId: string | undefined,
    @Param('professionalId') professionalId: string,
    @Param('slotId') slotId: string,
    @Body() body: UpdateAvailabilitySlotDTO,
  ) {
    return this.updateAvailabilitySlotUseCase.execute({
      tenantId,
      branchId,
      professionalId,
      slotId,
      date: body.date,
      action: body.action,
      contactId: body.contactId,
      categoryId: body.categoryId,
      notes: body.notes,
    });
  }

  @Post('professionals/:professionalId/availability/slots/:slotId/reschedule')
  @Roles('OWNER', 'ADMIN')
  async rescheduleReservation(
    @Param('tenantId') tenantId: string,
    @Query('branchId') branchId: string | undefined,
    @Param('professionalId') professionalId: string,
    @Param('slotId') slotId: string,
    @Body() body: RescheduleSchedulingReservationDTO,
  ) {
    return this.rescheduleSchedulingReservationUseCase.execute({
      tenantId,
      branchId,
      professionalId,
      sourceDate: body.sourceDate,
      sourceSlotId: slotId,
      targetDate: body.targetDate,
      targetSlotId: body.targetSlotId,
    });
  }

  @Post('professionals/:professionalId/availability/slots/:slotId/payment-link')
  @Roles('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.CREATED)
  async generatePaymentLink(
    @Param('tenantId') tenantId: string,
    @Query('branchId') branchId: string | undefined,
    @Param('professionalId') professionalId: string,
    @Param('slotId') slotId: string,
    @Body() body: GenerateSchedulingPaymentLinkDTO,
  ) {
    return this.generateSchedulingPaymentLinkUseCase.execute({
      tenantId,
      branchId,
      professionalId,
      slotId,
      date: body.date,
      billingType: body.billingType,
    });
  }

  @Post('professionals/:professionalId/availability/slots/:slotId/join-meeting')
  @Roles('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  async joinMeeting(
    @Param('tenantId') tenantId: string,
    @Query('branchId') branchId: string | undefined,
    @Param('professionalId') professionalId: string,
    @Param('slotId') slotId: string,
    @Body() body: { date: string; professionalName?: string },
  ) {
    return this.joinSchedulingMeetingUseCase.execute({
      tenantId,
      branchId,
      professionalId,
      slotId,
      date: body.date,
      professionalName: body.professionalName,
    });
  }

  @Post('report-jobs')
  @Roles('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.ACCEPTED)
  async startReportJob(
    @Param('tenantId') tenantId: string,
    @Query('branchId') branchId: string | undefined,
    @Body() body: GenerateSchedulingReportDTO,
    @Req() req: any,
  ) {
    const totalItems = this.estimateReportItems(body.startDate, body.endDate);

    const asyncJob = await this.schedulingAsyncJobsService.createJob({
      tenantId,
      branchId,
      type: 'EXPORT_SCHEDULING_REPORT_CSV',
      requestedByUserId: req.user?.sub,
      requestedByUserEmail: req.user?.email,
      totalItems,
      payload: {
        branchId,
        startDate: body.startDate,
        endDate: body.endDate,
        professionalIds: body.professionalIds ?? [],
        categoryIds: body.categoryIds ?? [],
        statuses: body.statuses ?? [],
      },
    });

    const queueJob = await this.schedulingAsyncQueue.add(
      'export-scheduling-report-csv',
      {
        asyncJobId: asyncJob.id,
        type: 'EXPORT_SCHEDULING_REPORT_CSV',
        tenantId,
        branchId,
        startDate: body.startDate,
        endDate: body.endDate,
        professionalIds: body.professionalIds ?? [],
        categoryIds: body.categoryIds ?? [],
        statuses: body.statuses ?? [],
        totalItems,
      },
      {
        jobId: asyncJob.id,
        attempts: 2,
        removeOnComplete: 50,
        removeOnFail: 200,
      },
    );

    await this.schedulingAsyncJobsService.attachQueueJobId(asyncJob.id, String(queueJob.id));
    return this.schedulingAsyncJobsService.getJob(tenantId, asyncJob.id);
  }

  @Get('jobs')
  @Roles('OWNER', 'ADMIN')
  async listJobs(@Param('tenantId') tenantId: string) {
    return this.schedulingAsyncJobsService.listJobs(tenantId);
  }

  @Get('jobs/:jobId')
  @Roles('OWNER', 'ADMIN')
  async getJob(@Param('tenantId') tenantId: string, @Param('jobId') jobId: string) {
    return this.schedulingAsyncJobsService.getJob(tenantId, jobId);
  }

  @Get('jobs/:jobId/download')
  @Roles('OWNER', 'ADMIN')
  async downloadJobFile(
    @Param('tenantId') tenantId: string,
    @Param('jobId') jobId: string,
    @Res() res: Response,
  ) {
    const file = await this.schedulingAsyncJobsService.getDownloadPayload(tenantId, jobId);

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

  @Post('reports')
  @Roles('OWNER', 'ADMIN')
  async generateReport(
    @Param('tenantId') tenantId: string,
    @Query('branchId') branchId: string | undefined,
    @Body() body: GenerateSchedulingReportDTO,
  ) {
    return this.generateSchedulingReportUseCase.execute({
      tenantId,
      branchId,
      startDate: body.startDate,
      endDate: body.endDate,
      professionalIds: body.professionalIds ?? [],
      categoryIds: body.categoryIds ?? [],
      statuses: body.statuses ?? [],
    });
  }

  private estimateReportItems(startDate: string, endDate: string): number {
    const start = new Date(`${startDate}T00:00:00.000Z`);
    const end = new Date(`${endDate}T00:00:00.000Z`);
    const diffInDays = Math.max(
      0,
      Math.floor((end.getTime() - start.getTime()) / 86400000),
    );

    return diffInDays + 1;
  }
}
