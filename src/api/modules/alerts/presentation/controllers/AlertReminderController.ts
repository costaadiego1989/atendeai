import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import {
  AuthenticatedUser,
  JwtCookieGuard,
} from '@shared/infrastructure/auth/guards/JwtCookieGuard';
import { CreateAlertReminderUseCase } from '../../application/use-cases/CreateAlertReminderUseCase';
import { ListAlertRemindersUseCase } from '../../application/use-cases/ListAlertRemindersUseCase';
import { UpdateAlertReminderUseCase } from '../../application/use-cases/UpdateAlertReminderUseCase';
import { DeleteAlertReminderUseCase } from '../../application/use-cases/DeleteAlertReminderUseCase';
import {
  CreateAlertReminderDTO,
  UpdateAlertReminderDTO,
} from '../dtos/AlertReminderDTOs';

@Controller('alerts/reminders')
@UseGuards(JwtCookieGuard)
export class AlertReminderController {
  constructor(
    private readonly createAlertReminderUseCase: CreateAlertReminderUseCase,
    private readonly listAlertRemindersUseCase: ListAlertRemindersUseCase,
    private readonly updateAlertReminderUseCase: UpdateAlertReminderUseCase,
    private readonly deleteAlertReminderUseCase: DeleteAlertReminderUseCase,
  ) {}

  @Get()
  async list(@Req() req: Request, @Query('branchId') branchId?: string) {
    const user = (req as unknown as { user: AuthenticatedUser }).user;
    return this.listAlertRemindersUseCase.execute({
      tenantId: user.tenantId,
      userId: user.sub,
      branchId,
    });
  }

  @Post()
  async create(@Req() req: Request, @Body() body: CreateAlertReminderDTO) {
    const user = (req as unknown as { user: AuthenticatedUser }).user;
    return this.createAlertReminderUseCase.execute({
      tenantId: user.tenantId,
      branchId: body.branchId,
      userId: user.sub,
      title: body.title,
      message: body.message,
      frequency: body.frequency,
      scheduledAt: body.scheduledAt,
      timeOfDay: body.timeOfDay,
      timezone: body.timezone,
    });
  }

  @Put(':id')
  async update(
    @Req() req: Request,
    @Param('id') reminderId: string,
    @Body() body: UpdateAlertReminderDTO,
  ) {
    const user = (req as unknown as { user: AuthenticatedUser }).user;
    return this.updateAlertReminderUseCase.execute({
      tenantId: user.tenantId,
      branchId: body.branchId,
      userId: user.sub,
      reminderId,
      title: body.title,
      message: body.message,
      frequency: body.frequency,
      scheduledAt: body.scheduledAt,
      timeOfDay: body.timeOfDay,
      status: body.status,
      timezone: body.timezone,
    });
  }

  @Delete(':id')
  async delete(@Req() req: Request, @Param('id') reminderId: string) {
    const user = (req as unknown as { user: AuthenticatedUser }).user;
    await this.deleteAlertReminderUseCase.execute({
      tenantId: user.tenantId,
      userId: user.sub,
      reminderId,
    });
    return { deleted: true };
  }
}
