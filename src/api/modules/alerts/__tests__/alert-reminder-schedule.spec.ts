import {
  assertValidReminderTimezone,
  computeNextDailyTriggerUtc,
  computeNextTriggerAt,
} from '../application/helpers/alert-reminder-schedule';

describe('alert-reminder-schedule', () => {
  const ref = new Date('2026-05-03T03:05:00.000Z');

  it('DAILY em UTC usa o mesmo dia quando HH:mm esta a frente', () => {
    expect(
      computeNextDailyTriggerUtc({
        timeOfDay: '09:00',
        now: ref,
        timezone: 'UTC',
      }),
    ).toBe('2026-05-03T09:00:00.000Z');
  });

  it('DAILY em UTC passa ao dia seguinte quando HH:mm ja passou', () => {
    expect(
      computeNextDailyTriggerUtc({
        timeOfDay: '02:00',
        now: ref,
        timezone: 'UTC',
      }),
    ).toBe('2026-05-04T02:00:00.000Z');
  });

  it('reject timezone invalido', () => {
    expect(() =>
      assertValidReminderTimezone('NaoEhZona/Realy'),
    ).toThrow();
  });

  it('computeNextTriggerAt DAILY delega zona', () => {
    const iso = computeNextTriggerAt({
      frequency: 'DAILY',
      timeOfDay: '09:00',
      now: ref,
      timezone: 'UTC',
    });
    expect(iso).toBe('2026-05-03T09:00:00.000Z');
  });
});
