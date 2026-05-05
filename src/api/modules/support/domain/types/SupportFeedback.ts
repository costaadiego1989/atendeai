export type SupportFeedbackType = 'BUG' | 'SUGGESTION' | 'IMPROVEMENT';
export type SupportFeedbackStatus = 'OPEN' | 'REVIEWED' | 'CLOSED';

export interface SupportFeedback {
  id: string;
  tenantId: string;
  branchId?: string | null;
  userId: string;
  userName: string;
  userEmail: string;
  type: SupportFeedbackType;
  title: string;
  description: string;
  pagePath?: string;
  appModule?: string | null;
  status: SupportFeedbackStatus;
  createdAt: string;
  updatedAt: string;
}
