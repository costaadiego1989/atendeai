import { apiClient } from '@/shared/api/client';
import type { SupportFeedback, SupportFeedbackType } from '@/shared/types';

export interface CreateSupportFeedbackInput {
  branchId?: string | null;
  type: SupportFeedbackType;
  title: string;
  description: string;
  pagePath?: string;
  appModule?: string;
}

export const supportService = {
  listFeedbacks(branchId?: string | null): Promise<SupportFeedback[]> {
    return apiClient.get('/support/feedbacks', {
      branchId: branchId ?? undefined,
    });
  },

  createFeedback(input: CreateSupportFeedbackInput): Promise<SupportFeedback> {
    return apiClient.post('/support/feedbacks', input);
  },
};
