import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  ISupportFeedbackRepository,
  SUPPORT_FEEDBACK_REPOSITORY,
} from '../../domain/repositories/ISupportFeedbackRepository';
import { SupportFeedbackStatus } from '../../domain/types/SupportFeedback';

export interface UpdateFeedbackStatusInput {
  feedbackId: string;
  status: SupportFeedbackStatus;
}

@Injectable()
export class UpdateFeedbackStatusUseCase {
  constructor(
    @Inject(SUPPORT_FEEDBACK_REPOSITORY)
    private readonly repository: ISupportFeedbackRepository,
  ) {}

  async execute(input: UpdateFeedbackStatusInput): Promise<void> {
    const feedback = await this.repository.findById(input.feedbackId);

    if (!feedback) {
      throw new NotFoundException('Feedback not found');
    }

    await this.repository.updateStatus(input.feedbackId, input.status);
  }
}
