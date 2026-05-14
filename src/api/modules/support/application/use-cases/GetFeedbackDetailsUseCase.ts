import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  ISupportFeedbackRepository,
  SUPPORT_FEEDBACK_REPOSITORY,
  SupportFeedbackReply,
} from '../../domain/repositories/ISupportFeedbackRepository';
import { SupportFeedback } from '../../domain/types/SupportFeedback';

export interface GetFeedbackDetailsOutput {
  feedback: SupportFeedback & { tenantName?: string };
  replies: SupportFeedbackReply[];
}

@Injectable()
export class GetFeedbackDetailsUseCase {
  constructor(
    @Inject(SUPPORT_FEEDBACK_REPOSITORY)
    private readonly repository: ISupportFeedbackRepository,
  ) {}

  async execute(feedbackId: string): Promise<GetFeedbackDetailsOutput> {
    const feedback = await this.repository.findById(feedbackId);

    if (!feedback) {
      throw new NotFoundException('Feedback not found');
    }

    const replies = await this.repository.listReplies(feedbackId);

    return { feedback, replies };
  }
}
