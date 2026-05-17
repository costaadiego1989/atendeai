import { Inject, Injectable } from '@nestjs/common';
import {
  ISupportFeedbackRepository,
  SUPPORT_FEEDBACK_REPOSITORY,
} from '../../domain/repositories/ISupportFeedbackRepository';
import { SupportFeedback } from '../../domain/types/SupportFeedback';

@Injectable()
export class ListSupportFeedbacksUseCase {
  constructor(
    @Inject(SUPPORT_FEEDBACK_REPOSITORY)
    private readonly repository: ISupportFeedbackRepository,
  ) {}

  async execute(input: {
    tenantId: string;
    branchId?: string;
  }): Promise<SupportFeedback[]> {
    return this.repository.findAllByTenant(input.tenantId, input.branchId);
  }
}
