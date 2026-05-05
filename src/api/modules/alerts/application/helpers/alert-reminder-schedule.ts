import { ValidationErrorException } from '@shared/domain/exceptions/DomainExceptions';
import { DateTime } from 'luxon';
import { AlertReminderFrequency } from '../../domain/types/AlertReminder';

function parseTimeOfDay(value: string): { hours: number; minutes: number } {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) {
    throw new ValidationErrorException('Reminder time must use HH:mm format');
  }

  return {
    hours: Number(match[1]),
    minutes: Number(match[2]),
  };
}

/** Valida zona IANA; devolve sempre string não-vazia. */
export function assertValidReminderTimezone(zone: string | undefined): string {
  const z = (zone ?? 'UTC').trim() || 'UTC';
  const probe = DateTime.now().setZone(z);
  if (!probe.isValid) {
    throw new ValidationErrorException(
      `Invalid IANA timezone: ${probe.invalidReason}`,
    );
  }
  return z;
}

/** Próximo disparo diário HH:mm à frente do instante `now` interpretado na zona. */
export function computeNextDailyTriggerUtc(input: {
  timeOfDay: string;
  now?: Date;
  timezone?: string;
}): string {
  const zone = assertValidReminderTimezone(input.timezone ?? 'UTC');
  const nowUtc = DateTime.fromJSDate(input.now ?? new Date(), { zone: 'utc' });
  const local = nowUtc.setZone(zone);

  const { hours, minutes } = parseTimeOfDay(input.timeOfDay);
  let candidate = local.set({
    hour: hours,
    minute: minutes,
    second: 0,
    millisecond: 0,
  });
  if (candidate <= local) {
    candidate = candidate.plus({ days: 1 });
  }
  return candidate.toUTC().toISO()!;
}

/** Após uma execução diária, agenda o mesmo HH:mm no dia seguinte (calendário na zona). */
export function computeNextDailyTriggerAfterLastRunUtc(
  timeOfDay: string,
  lastRunUtc: Date,
  timezone?: string,
): string {
  const zone = assertValidReminderTimezone(timezone ?? 'UTC');
  const anchorInZone = DateTime.fromJSDate(lastRunUtc, { zone: 'utc' }).setZone(
    zone,
  );

  const { hours, minutes } = parseTimeOfDay(timeOfDay);
  let next = anchorInZone
    .plus({ days: 1 })
    .set({
      hour: hours,
      minute: minutes,
      second: 0,
      millisecond: 0,
    });

  if (next <= anchorInZone) {
    next = next.plus({ days: 1 });
  }

  return next.toUTC().toISO()!;
}

export function computeNextTriggerAt(input: {
  frequency: AlertReminderFrequency;
  scheduledAt?: string;
  timeOfDay?: string;
  now?: Date;
  /** Opcional para lembretes DAILY; ONCE mantém ISO instant como veio do cliente. */
  timezone?: string;
}): string {
  const now = input.now ?? new Date();

  if (input.frequency === 'ONCE') {
    if (!input.scheduledAt) {
      throw new ValidationErrorException(
        'Scheduled date is required for one-time reminders',
      );
    }

    const scheduledUtc = DateTime.fromISO(input.scheduledAt, { zone: 'utc' });
    if (!scheduledUtc.isValid) {
      throw new ValidationErrorException('Scheduled date is invalid');
    }

    const nowUtc = DateTime.fromJSDate(now, { zone: 'utc' });
    if (scheduledUtc <= nowUtc) {
      throw new ValidationErrorException(
        'Scheduled date must be in the future',
      );
    }

    return scheduledUtc.toISO()!;
  }

  if (!input.timeOfDay) {
    throw new ValidationErrorException(
      'Reminder time is required for recurring reminders',
    );
  }

  return computeNextDailyTriggerUtc({
    timeOfDay: input.timeOfDay,
    now,
    timezone: input.timezone,
  });
}
