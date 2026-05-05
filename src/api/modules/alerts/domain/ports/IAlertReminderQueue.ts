export interface AlertReminderQueueJob {
  tenantId: string;
  reminderId: string;
  runAt: string;
}

export interface IAlertReminderQueue {
  addJob(job: AlertReminderQueueJob): Promise<void>;
}

export const ALERT_REMINDER_QUEUE = Symbol('IAlertReminderQueue');
