import { Inject, Injectable } from '@nestjs/common';
import {
  ISupportFeedbackRepository,
  SUPPORT_FEEDBACK_REPOSITORY,
  ListAllFeedbacksFilters,
  ListAllFeedbacksResult,
} from '../../domain/repositories/ISupportFeedbackRepository';

export interface ListAllFeedbacksInput {
  page?: number;
  limit?: number;
  type?: string;
  status?: string;
  tenantId?: string;
}

@Injectable()
export class ListAllFeedbacksUseCase {
  constructor(
    @Inject(SUPPORT_FEEDBACK_REPOSITORY)
    private readonly repository: ISupportFeedbackRepository,
  ) {}

  async execute(input: ListAllFeedbacksInput): Promise<ListAllFeedbacksResult> {
    return this.repository.findAll({
      page: input.page || 1,
      limit: input.limit || 20,
      type: input.type,
      status: input.status,
      tenantId: input.tenantId,
    });
  }
}
