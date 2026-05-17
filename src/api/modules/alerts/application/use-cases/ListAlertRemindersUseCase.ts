import { Inject, Injectable } from '@nestjs/common';
import {
  ALERT_REMINDER_REPOSITORY,
  IAlertReminderRepository,
} from '../../domain/repositories/IAlertReminderRepository';
import { AlertReminder } from '../../domain/types/AlertReminder';

@Injectable()
export class ListAlertRemindersUseCase {
  constructor(
    @Inject(ALERT_REMINDER_REPOSITORY)
    private readonly reminderRepository: IAlertReminderRepository,
  ) {}

  async execute(input: {
    tenantId: string;
    userId: string;
    branchId?: string;
  }): Promise<AlertReminder[]> {
    return this.reminderRepository.findAllByUser(
      input.tenantId,
      input.userId,
      input.branchId,
    );
  }
}
