import { renderAlertReminderBody } from '../application/helpers/alert-message-body';

describe('renderAlertReminderBody', () => {
  const baseValues = {
    title: 'T',
    message: 'M',
    reminderId: 'r1',
    tenantId: 't1',
  };

  it('substitui tokens', () => {
    expect(
      renderAlertReminderBody('x {title} y {tenant_id}', baseValues),
    ).toBe('x T y t1');
  });

  // ─── NEW scenarios ────────────────────────────────────────────────────────────

  it('returns empty string when template is empty', () => {
    expect(renderAlertReminderBody('', baseValues)).toBe('');
  });

  it('handles special characters in values without escaping', () => {
    const values = {
      title: '<script>alert("xss")</script>',
      message: 'line1\nline2\ttab',
      reminderId: 'r-special&chars',
      tenantId: 't/slash',
    };
    const result = renderAlertReminderBody('{title} | {message} | {reminder_id} | {tenant_id}', values);
    expect(result).toBe('<script>alert("xss")</script> | line1\nline2\ttab | r-special&chars | t/slash');
  });

  it('replaces multiple occurrences of the same token', () => {
    const template = '{title} - {title} - {title}';
    const result = renderAlertReminderBody(template, baseValues);
    expect(result).toBe('T - T - T');
  });

  it('leaves unreplaced tokens as-is when not in the known set', () => {
    const template = '{title} {unknown_token} {message}';
    const result = renderAlertReminderBody(template, baseValues);
    expect(result).toBe('T {unknown_token} M');
  });

  it('handles very long message body without truncation', () => {
    const longMessage = 'A'.repeat(10_000);
    const values = { ...baseValues, message: longMessage };
    const result = renderAlertReminderBody('{message}', values);
    expect(result).toHaveLength(10_000);
    expect(result).toBe(longMessage);
  });

  it('replaces all four tokens in default template', () => {
    const template = 'Lembrete: {title}\n\n{message}\n\nID: {reminder_id} Tenant: {tenant_id}';
    const result = renderAlertReminderBody(template, baseValues);
    expect(result).toBe('Lembrete: T\n\nM\n\nID: r1 Tenant: t1');
  });
});
