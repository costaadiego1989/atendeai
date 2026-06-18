import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  CONTACT_FACADE,
  IContactFacade,
} from '@modules/contact/application/facades/ContactFacade';
import {
  MESSAGING_FACADE,
  IMessagingFacade,
} from '@modules/messaging/application/facades/MessagingFacade';
import {
  ALERT_REMINDER_QUEUE,
  IAlertReminderQueue,
} from '../../domain/ports/IAlertReminderQueue';
import {
  ALERT_REMINDER_REPOSITORY,
  IAlertReminderRepository,
} from '../../domain/repositories/IAlertReminderRepository';
import type { AlertReminder } from '../../domain/types/AlertReminder';
import {
  assertValidReminderTimezone,
  computeNextDailyTriggerAfterLastRunUtc,
} from '../helpers/alert-reminder-schedule';
import { renderAlertReminderBody } from '../helpers/alert-message-body';
import { AlertReminderRuntimeConfig } from '../services/AlertReminderRuntimeConfig';

@Injectable()
export class ProcessAlertReminderUseCase {
  private readonly logger = new Logger(ProcessAlertReminderUseCase.name);

  constructor(
    @Inject(ALERT_REMINDER_REPOSITORY)
    private readonly reminderRepository: IAlertReminderRepository,
    @Inject(ALERT_REMINDER_QUEUE)
    private readonly reminderQueue: IAlertReminderQueue,
    @Inject(CONTACT_FACADE)
    private readonly contactFacade: IContactFacade,
    @Inject(MESSAGING_FACADE)
    private readonly messagingFacade: IMessagingFacade,
    private readonly runtime: AlertReminderRuntimeConfig,
  ) {}

  async execute(input: {
    tenantId: string;
    reminderId: string;
    jobId?: string;
  }): Promise<void> {
    const reminder = await this.reminderRepository.findById(
      input.tenantId,
      input.reminderId,
    );
    if (!reminder || reminder.status !== 'ACTIVE' || !reminder.nextTriggerAt) {
      return;
    }

    const now = new Date();
    const nextTriggerAt = new Date(reminder.nextTriggerAt);
    if (
      Number.isNaN(nextTriggerAt.getTime()) ||
      nextTriggerAt.getTime() > now.getTime() + 30_000
    ) {
      return;
    }

    const recentSec = this.runtime.duplicateTriggerSuppressionSeconds();
    if (reminder.lastTriggeredAt) {
      const last = new Date(reminder.lastTriggeredAt).getTime();
      if (!Number.isNaN(last) && now.getTime() - last < recentSec * 1000) {
        this.logger.debug(
          `replay_suppressed tenant=${input.tenantId} reminder=${input.reminderId} job=${input.jobId ?? 'n/a'}`,
        );
        return;
      }
    }

    const zone = this.resolveReminderTimezone(reminder);

    let skipOutbound = false;
    const cap = this.runtime.maxDispatchesPerRecipientRolling();
    if (cap > 0) {
      const horizonMs = this.runtime.antiSpamRollingHours() * 3600_000;
      const sinceIso = new Date(now.getTime() - horizonMs).toISOString();
      const recentDispatches =
        await this.reminderRepository.countRecipientDispatchesSince(
          reminder.tenantId,
          reminder.userPhone,
          sinceIso,
        );
      if (recentDispatches >= cap) {
        skipOutbound = true;
        this.logger.warn(
          `anti-spam_skip tenant=${reminder.tenantId} reminder=${reminder.id} job=${input.jobId ?? 'n/a'} window_h=${this.runtime.antiSpamRollingHours()} cap=${cap}`,
        );
      }
    }

    const updatedAt = new Date().toISOString();

    // Persist state BEFORE sending so that a concurrent worker arriving after
    // this point will hit the lastTriggeredAt dedup guard and exit early.
    // This is the "mark-then-act" pattern for at-least-once queue semantics.
    const updatedReminder: AlertReminder =
      reminder.frequency === 'ONCE'
        ? {
            ...reminder,
            timezone: zone,
            status: 'SENT',
            lastTriggeredAt: updatedAt,
            nextTriggerAt: undefined,
            updatedAt,
          }
        : {
            ...reminder,
            timezone: zone,
            lastTriggeredAt: updatedAt,
            nextTriggerAt: computeNextDailyTriggerAfterLastRunUtc(
              reminder.timeOfDay!,
              new Date(updatedAt),
              zone,
            ),
            updatedAt,
          };

    await this.reminderRepository.save(updatedReminder);

    if (!skipOutbound) {
      const text = renderAlertReminderBody(this.runtime.messageBodyTemplate(), {
        title: reminder.title,
        message: reminder.message,
        reminderId: reminder.id,
        tenantId: reminder.tenantId,
      });

      const ensured = await this.contactFacade.ensureContact({
        tenantId: reminder.tenantId,
        branchId: reminder.branchId ?? undefined,
        name: reminder.userName,
        phone: reminder.userPhone,
        email: reminder.userEmail,
        notes: 'Contato tecnico criado automaticamente para alertas pessoais',
        tags: ['internal_alerts'],
      });

      await this.messagingFacade.queueSystemMessage({
        tenantId: reminder.tenantId,
        contactId: ensured.contactId,
        branchId: reminder.branchId ?? null,
        channel: 'WHATSAPP',
        text,
      });
    }

    if (updatedReminder.status === 'ACTIVE' && updatedReminder.nextTriggerAt) {
      await this.reminderQueue.addJob({
        tenantId: updatedReminder.tenantId,
        reminderId: updatedReminder.id,
        runAt: updatedReminder.nextTriggerAt,
      });
    }
  }

  private resolveReminderTimezone(reminder: {
    timezone?: string | null;
  }): string {
    const raw = reminder.timezone?.trim();
    if (raw) {
      try {
        return assertValidReminderTimezone(raw);
      } catch {
        this.logger.warn(
          `invalid_timezone_fallback reminder uses default TZ raw=${raw}`,
        );
      }
    }
    return this.runtime.effectiveDefaultTimezone();
  }
}
