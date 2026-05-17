import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  AUTH_USER_REPOSITORY,
  IAuthUserRepository,
} from '@modules/auth/domain/repositories/IAuthUserRepository';
import {
  ITenantRepository,
  TENANT_REPOSITORY,
} from '@modules/tenant/domain/repositories/ITenantRepository';
import {
  EntityNotFoundException,
  ValidationErrorException,
} from '@shared/domain/exceptions/DomainExceptions';
import {
  ALERT_REMINDER_QUEUE,
  IAlertReminderQueue,
} from '../../domain/ports/IAlertReminderQueue';
import {
  ALERT_REMINDER_REPOSITORY,
  IAlertReminderRepository,
} from '../../domain/repositories/IAlertReminderRepository';
import {
  AlertReminder,
  AlertReminderFrequency,
} from '../../domain/types/AlertReminder';
import {
  assertValidReminderTimezone,
  computeNextTriggerAt,
} from '../helpers/alert-reminder-schedule';
import { AlertReminderRuntimeConfig } from '../services/AlertReminderRuntimeConfig';

export interface CreateAlertReminderInput {
  tenantId: string;
  branchId?: string;
  userId: string;
  title: string;
  message: string;
  frequency: AlertReminderFrequency;
  scheduledAt?: string;
  timeOfDay?: string;
  /** Opcional — IANA; omissão usa `ALERT_REMINDER_DEFAULT_TIMEZONE` */
  timezone?: string;
}

@Injectable()
export class CreateAlertReminderUseCase {
  constructor(
    @Inject(ALERT_REMINDER_REPOSITORY)
    private readonly reminderRepository: IAlertReminderRepository,
    @Inject(ALERT_REMINDER_QUEUE)
    private readonly reminderQueue: IAlertReminderQueue,
    @Inject(AUTH_USER_REPOSITORY)
    private readonly authUserRepository: IAuthUserRepository,
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepository: ITenantRepository,
    private readonly runtime: AlertReminderRuntimeConfig,
  ) {}

  async execute(input: CreateAlertReminderInput): Promise<AlertReminder> {
    const user = await this.authUserRepository.findById(input.userId);
    if (!user || user.tenantId !== input.tenantId) {
      throw new EntityNotFoundException('User', input.userId);
    }

    const tenant = await this.tenantRepository.findById(input.tenantId);
    const fallbackPhone = tenant?.owner?.phone?.value;
    const effectivePhone = user.phone ?? fallbackPhone;

    if (!effectivePhone) {
      throw new EntityNotFoundException('User phone', input.userId);
    }

    const resolvedTimezone = input.timezone?.trim().length
      ? assertValidReminderTimezone(input.timezone)
      : this.runtime.effectiveDefaultTimezone();

    const maxActive = this.runtime.maxActiveRemindersPerUser();
    if (maxActive > 0) {
      const current = await this.reminderRepository.countActiveByUser(
        input.tenantId,
        input.userId,
      );
      if (current >= maxActive) {
        throw new ValidationErrorException(
          `Active reminder limit exceeded (max ${maxActive} per user)`,
        );
      }
    }

    const now = new Date();
    const reminder: AlertReminder = {
      id: randomUUID(),
      tenantId: input.tenantId,
      branchId: input.branchId ?? null,
      userId: input.userId,
      userName: user.name,
      userPhone: effectivePhone,
      userEmail: user.email.value,
      timezone: resolvedTimezone,
      title: input.title.trim(),
      message: input.message.trim(),
      frequency: input.frequency,
      scheduledAt: input.scheduledAt,
      timeOfDay: input.timeOfDay,
      nextTriggerAt: computeNextTriggerAt({
        frequency: input.frequency,
        scheduledAt: input.scheduledAt,
        timeOfDay: input.timeOfDay,
        now,
        timezone: resolvedTimezone,
      }),
      status: 'ACTIVE',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    await this.reminderRepository.save(reminder);
    await this.reminderQueue.addJob({
      tenantId: reminder.tenantId,
      reminderId: reminder.id,
      runAt: reminder.nextTriggerAt!,
    });

    return reminder;
  }
}
