export function renderAlertReminderBody(
  template: string,
  values: {
    title: string;
    message: string;
    reminderId: string;
    tenantId: string;
  },
): string {
  return template
    .replaceAll('{title}', values.title)
    .replaceAll('{message}', values.message)
    .replaceAll('{reminder_id}', values.reminderId)
    .replaceAll('{tenant_id}', values.tenantId);
}
