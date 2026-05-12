import {
  assertValidReminderTimezone,
  computeNextDailyTriggerUtc,
  computeNextDailyTriggerAfterLastRunUtc,
  computeNextTriggerAt,
} from '../application/helpers/alert-reminder-schedule';

describe('alert-reminder-schedule', () => {
  const ref = new Date('2026-05-03T03:05:00.000Z');

  // ─── Existing tests ───────────────────────────────────────────────────────────

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

  // ─── NEW: Brazil timezone (America/Sao_Paulo) ────────────────────────────────

  it('DAILY in America/Sao_Paulo converts local time to UTC correctly', () => {
    // ref is 2026-05-03T03:05:00Z → in SP (UTC-3) it is 2026-05-03T00:05:00
    // timeOfDay 09:00 SP → 12:00 UTC same day
    const result = computeNextDailyTriggerUtc({
      timeOfDay: '09:00',
      now: ref,
      timezone: 'America/Sao_Paulo',
    });
    expect(result).toBe('2026-05-03T12:00:00.000Z');
  });

  it('DAILY in America/Sao_Paulo rolls to next day when local time has passed', () => {
    // ref 2026-05-03T03:05:00Z → SP 00:05. timeOfDay 00:00 already passed → next day
    const result = computeNextDailyTriggerUtc({
      timeOfDay: '00:00',
      now: ref,
      timezone: 'America/Sao_Paulo',
    });
    expect(result).toBe('2026-05-04T03:00:00.000Z');
  });

  // ─── NEW: DST transitions ────────────────────────────────────────────────────

  it('handles DST spring-forward (America/Sao_Paulo exits DST in Feb)', () => {
    // Brazil DST ends first Sunday of February — clocks go back 1h
    // Using a date in standard time to verify offset is -3
    const winterRef = new Date('2026-06-15T10:00:00.000Z'); // SP = 07:00 (UTC-3)
    const result = computeNextDailyTriggerUtc({
      timeOfDay: '08:00',
      now: winterRef,
      timezone: 'America/Sao_Paulo',
    });
    // 08:00 SP (UTC-3) = 11:00 UTC
    expect(result).toBe('2026-06-15T11:00:00.000Z');
  });

  it('handles DST in US timezone (America/New_York)', () => {
    // 2026-03-08 is DST start in US. After DST, NY is UTC-4
    const dstRef = new Date('2026-03-09T10:00:00.000Z'); // NY = 06:00 EDT (UTC-4)
    const result = computeNextDailyTriggerUtc({
      timeOfDay: '08:00',
      now: dstRef,
      timezone: 'America/New_York',
    });
    // 08:00 EDT = 12:00 UTC
    expect(result).toBe('2026-03-09T12:00:00.000Z');
  });

  // ─── NEW: Month/year boundary ────────────────────────────────────────────────

  it('rolls over month boundary correctly', () => {
    const endOfMonth = new Date('2026-01-31T23:30:00.000Z');
    const result = computeNextDailyTriggerUtc({
      timeOfDay: '23:00',
      now: endOfMonth,
      timezone: 'UTC',
    });
    expect(result).toBe('2026-02-01T23:00:00.000Z');
  });

  it('rolls over year boundary correctly', () => {
    const endOfYear = new Date('2026-12-31T23:30:00.000Z');
    const result = computeNextDailyTriggerUtc({
      timeOfDay: '23:00',
      now: endOfYear,
      timezone: 'UTC',
    });
    expect(result).toBe('2027-01-01T23:00:00.000Z');
  });

  // ─── NEW: computeNextDailyTriggerAfterLastRunUtc edge cases ───────────────────

  it('computeNextDailyTriggerAfterLastRunUtc schedules next day same time', () => {
    const lastRun = new Date('2026-05-03T12:00:00.000Z');
    const result = computeNextDailyTriggerAfterLastRunUtc('09:00', lastRun, 'America/Sao_Paulo');
    // lastRun in SP = 09:00. Next day 09:00 SP = 2026-05-04T12:00:00Z
    expect(result).toBe('2026-05-04T12:00:00.000Z');
  });

  it('computeNextDailyTriggerAfterLastRunUtc at midnight boundary', () => {
    const lastRun = new Date('2026-05-03T03:00:00.000Z'); // SP = 00:00
    const result = computeNextDailyTriggerAfterLastRunUtc('00:00', lastRun, 'America/Sao_Paulo');
    // Next day 00:00 SP = 2026-05-04T03:00:00Z
    expect(result).toBe('2026-05-04T03:00:00.000Z');
  });

  it('computeNextDailyTriggerAfterLastRunUtc defaults to UTC when timezone omitted', () => {
    const lastRun = new Date('2026-05-03T10:00:00.000Z');
    const result = computeNextDailyTriggerAfterLastRunUtc('10:00', lastRun);
    expect(result).toBe('2026-05-04T10:00:00.000Z');
  });

  // ─── NEW: Invalid timezone handling ───────────────────────────────────────────

  it('assertValidReminderTimezone returns UTC for undefined input', () => {
    expect(assertValidReminderTimezone(undefined)).toBe('UTC');
  });

  it('assertValidReminderTimezone returns UTC for empty string', () => {
    expect(assertValidReminderTimezone('')).toBe('UTC');
  });

  it('assertValidReminderTimezone accepts valid IANA zone', () => {
    expect(assertValidReminderTimezone('America/Sao_Paulo')).toBe('America/Sao_Paulo');
  });

  // ─── NEW: Past time today → next day ─────────────────────────────────────────

  it('DAILY when exact same minute has passed rolls to next day', () => {
    // now is exactly 09:00 UTC → candidate equals now → should roll
    const exactNow = new Date('2026-05-03T09:00:00.000Z');
    const result = computeNextDailyTriggerUtc({
      timeOfDay: '09:00',
      now: exactNow,
      timezone: 'UTC',
    });
    expect(result).toBe('2026-05-04T09:00:00.000Z');
  });

  // ─── NEW: computeNextTriggerAt ONCE validations ───────────────────────────────

  it('computeNextTriggerAt ONCE throws when scheduledAt is missing', () => {
    expect(() =>
      computeNextTriggerAt({ frequency: 'ONCE', now: ref }),
    ).toThrow('Scheduled date is required');
  });

  it('computeNextTriggerAt ONCE throws when scheduledAt is in the past', () => {
    expect(() =>
      computeNextTriggerAt({
        frequency: 'ONCE',
        scheduledAt: '2020-01-01T00:00:00.000Z',
        now: ref,
      }),
    ).toThrow('Scheduled date must be in the future');
  });

  it('computeNextTriggerAt DAILY throws when timeOfDay is missing', () => {
    expect(() =>
      computeNextTriggerAt({ frequency: 'DAILY', now: ref }),
    ).toThrow('Reminder time is required');
  });

  it('computeNextTriggerAt DAILY throws for invalid timeOfDay format', () => {
    expect(() =>
      computeNextTriggerAt({ frequency: 'DAILY', timeOfDay: '9:00', now: ref }),
    ).toThrow('HH:mm');
  });
});
