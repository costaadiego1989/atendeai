import { apiClient } from '@/shared/api/client';
import type {
  AlertReminder,
  AlertReminderFrequency,
  AlertReminderStatus,
} from '@/shared/types';

export interface CreateAlertReminderInput {
  branchId?: string | null;
  title: string;
  message: string;
  frequency: AlertReminderFrequency;
  scheduledAt?: string;
  timeOfDay?: string;
  timezone?: string;
}

export interface UpdateAlertReminderInput {
  branchId?: string | null;
  title?: string;
  message?: string;
  frequency?: AlertReminderFrequency;
  scheduledAt?: string;
  timeOfDay?: string;
  timezone?: string;
  status?: AlertReminderStatus;
}

export const alertsService = {
  listReminders(branchId?: string | null): Promise<AlertReminder[]> {
    return apiClient.get('/alerts/reminders', {
      branchId: branchId ?? undefined,
    });
  },

  createReminder(input: CreateAlertReminderInput): Promise<AlertReminder> {
    return apiClient.post('/alerts/reminders', input);
  },

  updateReminder(
    reminderId: string,
    input: UpdateAlertReminderInput,
  ): Promise<AlertReminder> {
    return apiClient.put(`/alerts/reminders/${reminderId}`, input);
  },

  deleteReminder(reminderId: string): Promise<{ deleted: boolean }> {
    return apiClient.delete(`/alerts/reminders/${reminderId}`);
  },
};
