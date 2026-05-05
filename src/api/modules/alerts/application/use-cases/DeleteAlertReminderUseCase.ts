import { Inject, Injectable } from '@nestjs/common';
import { EntityNotFoundException } from '@shared/domain/exceptions/DomainExceptions';
import { ALERT_REMINDER_REPOSITORY, IAlertReminderRepository } from '../../domain/repositories/IAlertReminderRepository';

@Injectable()
export class DeleteAlertReminderUseCase {
  constructor(
    @Inject(ALERT_REMINDER_REPOSITORY)
    private readonly reminderRepository: IAlertReminderRepository,
  ) {}

  async execute(input: { tenantId: string; userId: string; reminderId: string }): Promise<void> {
    const reminder = await this.reminderRepository.findById(input.tenantId, input.reminderId);
    if (!reminder || reminder.userId !== input.userId) {
      throw new EntityNotFoundException('Alert reminder', input.reminderId);
    }

    await this.reminderRepository.delete(input.tenantId, input.reminderId);
  }
}
