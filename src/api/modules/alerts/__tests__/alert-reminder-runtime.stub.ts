export function stubAlertReminderRuntimeConfig(): any {
  return {
    effectiveDefaultTimezone: () => 'UTC',
    messageBodyTemplate: () => 'Lembrete: {title}\n\n{message}',
    maxActiveRemindersPerUser: () => 0,
    antiSpamRollingHours: () => 24,
    maxDispatchesPerRecipientRolling: () => 0,
    duplicateTriggerSuppressionSeconds: () => 90,
  };
}
