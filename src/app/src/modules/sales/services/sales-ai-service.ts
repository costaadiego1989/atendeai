import { apiClient } from '@/shared/api/client';
import { withBranchQuery } from './sales-service-helpers';
import type { AISalesPaymentLinkSuggestion } from './sales-types';

export const salesAIService = {
  suggestPaymentLinkWithAI(
    prompt: string,
    branchId?: string | null,
  ): Promise<AISalesPaymentLinkSuggestion> {
    return apiClient.post(withBranchQuery('/sales/links/ai-suggestions', branchId), {
      prompt,
    });
  },
};
