export type AlertReminderFrequency = 'ONCE' | 'DAILY';
export type AlertReminderStatus = 'ACTIVE' | 'PAUSED' | 'SENT';

export interface AlertReminder {
  id: string;
  tenantId: string;
  branchId?: string | null;
  userId: string;
  userName: string;
  userPhone: string;
  userEmail?: string;
  timezone?: string | null;
  title: string;
  message: string;
  frequency: AlertReminderFrequency;
  scheduledAt?: string;
  timeOfDay?: string;
  nextTriggerAt?: string;
  lastTriggeredAt?: string;
  status: AlertReminderStatus;
  createdAt: string;
  updatedAt: string;
}
