import { SupportFeedback, SupportFeedbackStatus } from '../types/SupportFeedback';

export interface SupportFeedbackReply {
  id: string;
  feedbackId: string;
  authorName: string;
  message: string;
  sentVia?: string | null;
  messageId?: string | null;
  createdAt: string;
}

export interface ListAllFeedbacksFilters {
  page?: number;
  limit?: number;
  type?: string;
  status?: string;
  tenantId?: string;
}

export interface ListAllFeedbacksResult {
  data: SupportFeedback[];
  total: number;
}

export interface CreateReplyInput {
  feedbackId: string;
  authorName: string;
  message: string;
  sentVia?: string;
  messageId?: string;
}

export interface ISupportFeedbackRepository {
  save(feedback: SupportFeedback): Promise<void>;
  findAllByTenant(tenantId: string, branchId?: string): Promise<SupportFeedback[]>;
  findAll(filters: ListAllFeedbacksFilters): Promise<ListAllFeedbacksResult>;
  findById(feedbackId: string): Promise<SupportFeedback | null>;
  updateStatus(feedbackId: string, status: SupportFeedbackStatus): Promise<void>;
  createReply(input: CreateReplyInput): Promise<SupportFeedbackReply>;
  listReplies(feedbackId: string): Promise<SupportFeedbackReply[]>;
}

export const SUPPORT_FEEDBACK_REPOSITORY = Symbol('ISupportFeedbackRepository');
