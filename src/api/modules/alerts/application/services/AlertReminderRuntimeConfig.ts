import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { assertValidReminderTimezone } from '../helpers/alert-reminder-schedule';

@Injectable()
export class AlertReminderRuntimeConfig {
  constructor(private readonly config: ConfigService) {}

  effectiveDefaultTimezone(): string {
    const raw =
      this.config.get<string>('ALERT_REMINDER_DEFAULT_TIMEZONE') ?? 'UTC';
    return assertValidReminderTimezone(raw);
  }

  messageBodyTemplate(): string {
    const t =
      this.config.get<string>('ALERT_REMINDER_BODY_TEMPLATE') ??
      'Lembrete: {title}\n\n{message}';
    return t;
  }

  maxActiveRemindersPerUser(): number {
    const n = Number(
      this.config.get<string>('ALERT_MAX_ACTIVE_REMINDERS_PER_USER'),
    );
    if (!Number.isFinite(n) || n < 1) {
      return 0;
    }
    return Math.min(Math.trunc(n), 500);
  }

  antiSpamRollingHours(): number {
    const n = Number(this.config.get<string>('ALERT_ANTI_SPAM_ROLLING_HOURS'));
    if (!Number.isFinite(n) || n <= 0) {
      return 24;
    }
    return Math.min(Math.trunc(n), 720);
  }

  maxDispatchesPerRecipientRolling(): number {
    const n = Number(
      this.config.get<string>('ALERT_MAX_DISPATCHES_PER_RECIPIENT_ROLLING'),
    );
    if (!Number.isFinite(n) || n <= 0) {
      return 0;
    }
    return Math.min(Math.trunc(n), 500);
  }

  duplicateTriggerSuppressionSeconds(): number {
    const n = Number(
      this.config.get<string>('ALERT_IDEMPOTENCY_RECENT_SECONDS'),
    );
    if (!Number.isFinite(n) || n <= 0) {
      return 90;
    }
    return Math.min(Math.trunc(n), 86400);
  }
}
