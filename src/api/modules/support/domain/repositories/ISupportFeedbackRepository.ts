import { SupportFeedback } from '../types/SupportFeedback';

export interface ISupportFeedbackRepository {
  save(feedback: SupportFeedback): Promise<void>;
  findAllByTenant(tenantId: string, branchId?: string): Promise<SupportFeedback[]>;
}

export const SUPPORT_FEEDBACK_REPOSITORY = Symbol('ISupportFeedbackRepository');
