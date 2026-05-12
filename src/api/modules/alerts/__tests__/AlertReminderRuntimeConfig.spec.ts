import { AlertReminderRuntimeConfig } from '../application/services/AlertReminderRuntimeConfig';

function createConfigService(env: Record<string, string | undefined> = {}): any {
  return {
    get: (key: string) => env[key],
  };
}

describe('AlertReminderRuntimeConfig', () => {
  // ─── effectiveDefaultTimezone ─────────────────────────────────────────────────

  it('returns UTC when ALERT_REMINDER_DEFAULT_TIMEZONE is not set', () => {
    const sut = new AlertReminderRuntimeConfig(createConfigService());
    expect(sut.effectiveDefaultTimezone()).toBe('UTC');
  });

  it('returns configured timezone when valid IANA zone is set', () => {
    const sut = new AlertReminderRuntimeConfig(
      createConfigService({ ALERT_REMINDER_DEFAULT_TIMEZONE: 'America/Sao_Paulo' }),
    );
    expect(sut.effectiveDefaultTimezone()).toBe('America/Sao_Paulo');
  });

  it('throws when ALERT_REMINDER_DEFAULT_TIMEZONE is invalid', () => {
    const sut = new AlertReminderRuntimeConfig(
      createConfigService({ ALERT_REMINDER_DEFAULT_TIMEZONE: 'Invalid/Zone' }),
    );
    expect(() => sut.effectiveDefaultTimezone()).toThrow();
  });

  // ─── messageBodyTemplate ──────────────────────────────────────────────────────

  it('returns default template when env is not set', () => {
    const sut = new AlertReminderRuntimeConfig(createConfigService());
    expect(sut.messageBodyTemplate()).toBe('Lembrete: {title}\n\n{message}');
  });

  it('returns custom template from env', () => {
    const sut = new AlertReminderRuntimeConfig(
      createConfigService({ ALERT_REMINDER_BODY_TEMPLATE: 'Custom: {title}' }),
    );
    expect(sut.messageBodyTemplate()).toBe('Custom: {title}');
  });

  // ─── maxActiveRemindersPerUser ────────────────────────────────────────────────

  it('returns 0 (unlimited) when env is not set', () => {
    const sut = new AlertReminderRuntimeConfig(createConfigService());
    expect(sut.maxActiveRemindersPerUser()).toBe(0);
  });

  it('returns parsed value when valid number is set', () => {
    const sut = new AlertReminderRuntimeConfig(
      createConfigService({ ALERT_MAX_ACTIVE_REMINDERS_PER_USER: '10' }),
    );
    expect(sut.maxActiveRemindersPerUser()).toBe(10);
  });

  it('caps at 500 when value exceeds limit', () => {
    const sut = new AlertReminderRuntimeConfig(
      createConfigService({ ALERT_MAX_ACTIVE_REMINDERS_PER_USER: '9999' }),
    );
    expect(sut.maxActiveRemindersPerUser()).toBe(500);
  });

  it('returns 0 for non-numeric env value', () => {
    const sut = new AlertReminderRuntimeConfig(
      createConfigService({ ALERT_MAX_ACTIVE_REMINDERS_PER_USER: 'abc' }),
    );
    expect(sut.maxActiveRemindersPerUser()).toBe(0);
  });

  // ─── duplicateTriggerSuppressionSeconds ───────────────────────────────────────

  it('returns default 90 when env is not set', () => {
    const sut = new AlertReminderRuntimeConfig(createConfigService());
    expect(sut.duplicateTriggerSuppressionSeconds()).toBe(90);
  });

  it('returns parsed suppression seconds', () => {
    const sut = new AlertReminderRuntimeConfig(
      createConfigService({ ALERT_IDEMPOTENCY_RECENT_SECONDS: '120' }),
    );
    expect(sut.duplicateTriggerSuppressionSeconds()).toBe(120);
  });

  it('caps suppression seconds at 86400', () => {
    const sut = new AlertReminderRuntimeConfig(
      createConfigService({ ALERT_IDEMPOTENCY_RECENT_SECONDS: '999999' }),
    );
    expect(sut.duplicateTriggerSuppressionSeconds()).toBe(86400);
  });

  // ─── antiSpamRollingHours ─────────────────────────────────────────────────────

  it('returns default 24 when env is not set', () => {
    const sut = new AlertReminderRuntimeConfig(createConfigService());
    expect(sut.antiSpamRollingHours()).toBe(24);
  });

  it('caps antiSpamRollingHours at 720', () => {
    const sut = new AlertReminderRuntimeConfig(
      createConfigService({ ALERT_ANTI_SPAM_ROLLING_HOURS: '9999' }),
    );
    expect(sut.antiSpamRollingHours()).toBe(720);
  });

  // ─── maxDispatchesPerRecipientRolling ─────────────────────────────────────────

  it('returns 0 (disabled) when env is not set', () => {
    const sut = new AlertReminderRuntimeConfig(createConfigService());
    expect(sut.maxDispatchesPerRecipientRolling()).toBe(0);
  });

  it('returns parsed dispatches cap', () => {
    const sut = new AlertReminderRuntimeConfig(
      createConfigService({ ALERT_MAX_DISPATCHES_PER_RECIPIENT_ROLLING: '5' }),
    );
    expect(sut.maxDispatchesPerRecipientRolling()).toBe(5);
  });
});
