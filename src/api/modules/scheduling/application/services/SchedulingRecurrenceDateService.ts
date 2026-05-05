import { Injectable } from '@nestjs/common';
import { SchedulingRecurrencePeriod } from '../../domain/ports/ISchedulingRecurringReservationRepository';

@Injectable()
export class SchedulingRecurrenceDateService {
  getNextDate(
    date: string,
    period: SchedulingRecurrencePeriod,
    interval = 1,
  ): string {
    const next = new Date(`${date}T12:00:00.000Z`);
    const normalizedInterval = Math.max(1, interval);

    if (period === 'DAILY') {
      next.setUTCDate(next.getUTCDate() + normalizedInterval);
    }

    if (period === 'WEEKLY') {
      next.setUTCDate(next.getUTCDate() + 7 * normalizedInterval);
    }

    if (period === 'BIWEEKLY') {
      next.setUTCDate(next.getUTCDate() + 14 * normalizedInterval);
    }

    if (period === 'MONTHLY') {
      next.setUTCMonth(next.getUTCMonth() + normalizedInterval);
    }

    return next.toISOString().slice(0, 10);
  }

  getRunAt(date: string): Date {
    return new Date(`${date}T03:00:00.000Z`);
  }

  makeSlotId(date: string, startsAt: string, endsAt: string): string {
    return `${date}__${startsAt}__${endsAt}`;
  }
}
