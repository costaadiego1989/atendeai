import { Inject, Injectable } from '@nestjs/common';
import {
  AUTH_USER_REPOSITORY,
  IAuthUserRepository,
} from '@modules/auth/domain/repositories/IAuthUserRepository';
import {
  ITenantRepository,
  TENANT_REPOSITORY,
} from '@modules/tenant/domain/repositories/ITenantRepository';
import { EntityNotFoundException } from '@shared/domain/exceptions/DomainExceptions';
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
  AlertReminderStatus,
} from '../../domain/types/AlertReminder';
import {
  assertValidReminderTimezone,
  computeNextTriggerAt,
} from '../helpers/alert-reminder-schedule';
import { AlertReminderRuntimeConfig } from '../services/AlertReminderRuntimeConfig';

export interface UpdateAlertReminderInput {
  tenantId: string;
  branchId?: string;
  userId: string;
  reminderId: string;
  title?: string;
  message?: string;
  frequency?: AlertReminderFrequency;
  scheduledAt?: string;
  timeOfDay?: string;
  status?: AlertReminderStatus;
  /** Se enviado (inclui string vazia), normaliza zona; omitir preserva zona guardada ou default */
  timezone?: string;
}

@Injectable()
export class UpdateAlertReminderUseCase {
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

  async execute(input: UpdateAlertReminderInput): Promise<AlertReminder> {
    const reminder = await this.reminderRepository.findById(
      input.tenantId,
      input.reminderId,
    );
    if (!reminder || reminder.userId !== input.userId) {
      throw new EntityNotFoundException('Alert reminder', input.reminderId);
    }

    const user = await this.authUserRepository.findById(input.userId);
    const tenant = await this.tenantRepository.findById(input.tenantId);
    const effectivePhone = user?.phone ?? tenant?.owner?.phone?.value;
    if (!user || user.tenantId !== input.tenantId || !effectivePhone) {
      throw new EntityNotFoundException('User phone', input.userId);
    }

    let resolvedTimezone: string;
    if (input.timezone !== undefined) {
      resolvedTimezone = input.timezone.trim().length
        ? assertValidReminderTimezone(input.timezone)
        : this.runtime.effectiveDefaultTimezone();
    } else {
      const legacy = reminder.timezone?.trim();
      if (!legacy) {
        resolvedTimezone = this.runtime.effectiveDefaultTimezone();
      } else {
        try {
          resolvedTimezone = assertValidReminderTimezone(legacy);
        } catch {
          resolvedTimezone = this.runtime.effectiveDefaultTimezone();
        }
      }
    }

    const frequency = input.frequency ?? reminder.frequency;
    const status = input.status ?? reminder.status;
    const updated: AlertReminder = {
      ...reminder,
      branchId: input.branchId ?? reminder.branchId ?? null,
      userName: user.name,
      userPhone: effectivePhone,
      userEmail: user.email.value,
      timezone: resolvedTimezone,
      title: input.title?.trim() ?? reminder.title,
      message: input.message?.trim() ?? reminder.message,
      frequency,
      scheduledAt:
        frequency === 'ONCE'
          ? (input.scheduledAt ?? reminder.scheduledAt)
          : undefined,
      timeOfDay:
        frequency === 'DAILY'
          ? (input.timeOfDay ?? reminder.timeOfDay)
          : undefined,
      status,
      updatedAt: new Date().toISOString(),
      nextTriggerAt:
        status === 'ACTIVE'
          ? computeNextTriggerAt({
              frequency,
              scheduledAt:
                frequency === 'ONCE'
                  ? (input.scheduledAt ?? reminder.scheduledAt)
                  : undefined,
              timeOfDay:
                frequency === 'DAILY'
                  ? (input.timeOfDay ?? reminder.timeOfDay)
                  : undefined,
              timezone: resolvedTimezone,
            })
          : reminder.nextTriggerAt,
    };

    await this.reminderRepository.save(updated);
    if (updated.status === 'ACTIVE' && updated.nextTriggerAt) {
      await this.reminderQueue.addJob({
        tenantId: updated.tenantId,
        reminderId: updated.id,
        runAt: updated.nextTriggerAt,
      });
    }

    return updated;
  }
}
