import { AlertReminder } from '../types/AlertReminder';

export interface IAlertReminderRepository {
  save(reminder: AlertReminder): Promise<void>;
  findById(tenantId: string, reminderId: string): Promise<AlertReminder | null>;
  findAllByUser(
    tenantId: string,
    userId: string,
    branchId?: string,
  ): Promise<AlertReminder[]>;
  delete(tenantId: string, reminderId: string): Promise<void>;
  countActiveByUser(tenantId: string, userId: string): Promise<number>;
  countRecipientDispatchesSince(
    tenantId: string,
    userPhone: string,
    sinceIso: string,
  ): Promise<number>;
}

export const ALERT_REMINDER_REPOSITORY = Symbol('IAlertReminderRepository');
