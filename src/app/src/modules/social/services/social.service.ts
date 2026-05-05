import { apiClient } from '@/shared/api/client';
import type {
  SocialAccount,
  SocialComment,
  SocialCommentReply,
  SocialAutoReplyRule,
  ConnectInstagramPayload,
  SendInboxMessagePayload,
  CreateSocialRuleInput,
} from './types';

export const socialService = {
  async listAccounts(tenantId: string): Promise<SocialAccount[]> {
    return apiClient.get<SocialAccount[]>(`/tenants/${tenantId}/social/accounts`);
  },

  async connectInstagram(tenantId: string, payload: ConnectInstagramPayload): Promise<{ id: string; status: string }> {
    return apiClient.post<{ id: string; status: string }>(
      `/tenants/${tenantId}/social/accounts/instagram/connect`,
      payload,
    );
  },

  async disconnectAccount(tenantId: string, accountId: string): Promise<{ success: boolean }> {
    return apiClient.delete<{ success: boolean }>(`/tenants/${tenantId}/social/accounts/${accountId}`);
  },

  async listComments(
    tenantId: string,
    filters?: { page?: number; limit?: number; status?: string; platform?: string; postId?: string },
  ): Promise<{ data: SocialComment[]; total: number; page: number; limit: number }> {
    return apiClient.get<{ data: SocialComment[]; total: number; page: number; limit: number }>(
      `/tenants/${tenantId}/social/comments`,
      filters,
    );
  },

  async getCommentThread(
    tenantId: string,
    commentId: string,
  ): Promise<{ comment: Partial<SocialComment>; replies: SocialCommentReply[] }> {
    return apiClient.get<{ comment: Partial<SocialComment>; replies: SocialCommentReply[] }>(
      `/tenants/${tenantId}/social/comments/${commentId}/thread`,
    );
  },

  async replyToComment(
    tenantId: string,
    commentId: string,
    text: string,
  ): Promise<{ success: boolean; replyId?: string; error?: string }> {
    return apiClient.post<{ success: boolean; replyId?: string; error?: string }>(
      `/tenants/${tenantId}/social/comments/${commentId}/reply`,
      { text },
    );
  },

  async sendInboxMessage(
    tenantId: string,
    payload: SendInboxMessagePayload,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    return apiClient.post<{ success: boolean; messageId?: string; error?: string }>(
      `/tenants/${tenantId}/social/inbox/send`,
      payload,
    );
  },

  async listRules(tenantId: string): Promise<SocialAutoReplyRule[]> {
    return apiClient.get<SocialAutoReplyRule[]>(`/tenants/${tenantId}/social/rules`);
  },

  async createRule(
    tenantId: string,
    payload: CreateSocialRuleInput,
  ): Promise<{ id: string }> {
    return apiClient.post<{ id: string }>(`/tenants/${tenantId}/social/rules`, payload);
  },

  async updateRule(
    tenantId: string,
    ruleId: string,
    payload: Partial<SocialAutoReplyRule>,
  ): Promise<{ success: boolean; error?: string }> {
    return apiClient.put<{ success: boolean; error?: string }>(`/tenants/${tenantId}/social/rules/${ruleId}`, payload);
  },

  async toggleRule(tenantId: string, ruleId: string): Promise<{ isActive: boolean; error?: string }> {
    return apiClient.patch<{ isActive: boolean; error?: string }>(`/tenants/${tenantId}/social/rules/${ruleId}/toggle`);
  },

  async deleteRule(tenantId: string, ruleId: string): Promise<{ success: boolean }> {
    return apiClient.delete<{ success: boolean }>(`/tenants/${tenantId}/social/rules/${ruleId}`);
  },

  async getStats(tenantId: string): Promise<{
    totalComments: number;
    pendingComments: number;
    repliedComments: number;
    autoRepliedComments: number;
    activeRules: number;
    connectedAccounts: number;
  }> {
    return apiClient.get(`/tenants/${tenantId}/social/stats`);
  }
};
