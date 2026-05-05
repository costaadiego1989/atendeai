import { renderAlertReminderBody } from '../application/helpers/alert-message-body';

describe('renderAlertReminderBody', () => {
  it('substitui tokens', () => {
    expect(
      renderAlertReminderBody('x {title} y {tenant_id}', {
        title: 'T',
        message: 'M',
        reminderId: 'r1',
        tenantId: 't1',
      }),
    ).toBe('x T y t1');
  });
});
