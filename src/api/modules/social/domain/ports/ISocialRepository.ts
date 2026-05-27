import { SocialAccount } from '../entities/SocialAccount';
import { SocialComment } from '../entities/SocialComment';
import { SocialAutoReplyRule } from '../entities/SocialAutoReplyRule';

export interface ISocialRepository {
  saveAccount(account: SocialAccount): Promise<void>;
  findAccountById(tenantId: string, id: string): Promise<SocialAccount | null>;
  findAccountByPlatform(
    tenantId: string,
    platform: string,
    externalAccountId: string,
  ): Promise<SocialAccount | null>;
  listKnownTenantsByPlatform(
    platform: string,
    externalAccountId: string,
  ): Promise<Array<{ tenantId: string }>>;
  listAccounts(tenantId: string): Promise<SocialAccount[]>;
  deleteAccount(tenantId: string, id: string): Promise<void>;
  upsertPost(
    tenantId: string,
    post: {
      socialAccountId: string;
      platform: string;
      externalPostId: string;
      postType?: string;
      caption?: string;
      mediaUrl?: string;
      permalink?: string;
      postedAt?: Date;
    },
  ): Promise<string>;
  saveComment(comment: SocialComment): Promise<void>;
  findCommentById(tenantId: string, id: string): Promise<SocialComment | null>;
  findCommentByExternalId(
    tenantId: string,
    externalCommentId: string,
  ): Promise<SocialComment | null>;
  listComments(
    tenantId: string,
    filters: {
      status?: string;
      postId?: string;
      platform?: string;
      page?: number;
      limit?: number;
    },
  ): Promise<{ comments: SocialComment[]; total: number }>;
  updateCommentStatus(
    tenantId: string,
    commentId: string,
    status: string,
    repliedAt?: Date,
  ): Promise<void>;
  saveReply(
    tenantId: string,
    reply: {
      commentId: string;
      externalReplyId?: string;
      text: string;
      repliedBy: 'AI' | 'HUMAN';
      ruleId?: string;
      userId?: string;
      status: string;
      errorMessage?: string;
    },
  ): Promise<string>;
  listReplies(
    tenantId: string,
    commentId: string,
  ): Promise<
    Array<{
      id: string;
      text: string;
      repliedBy: string;
      ruleId?: string;
      status: string;
      createdAt: Date;
    }>
  >;
  saveRule(rule: SocialAutoReplyRule): Promise<void>;
  findRuleById(
    tenantId: string,
    id: string,
  ): Promise<SocialAutoReplyRule | null>;
  listActiveRules(
    tenantId: string,
    platform?: string,
  ): Promise<SocialAutoReplyRule[]>;
  listAllRules(tenantId: string): Promise<SocialAutoReplyRule[]>;
  deleteRule(tenantId: string, id: string): Promise<void>;
  incrementRuleFired(tenantId: string, ruleId: string): Promise<void>;
  countRepliesByRuleInLastHour(
    tenantId: string,
    ruleId: string,
  ): Promise<number>;
  countRepliesForPostByRule(
    tenantId: string,
    ruleId: string,
    postId: string,
  ): Promise<number>;
  findLastReplyToUser(
    tenantId: string,
    ruleId: string,
    authorExternalId: string,
  ): Promise<Date | null>;
  upsertInboxThread(
    tenantId: string,
    thread: {
      socialAccountId: string;
      platform: string;
      recipientExternalId: string;
      recipientUsername?: string;
      originCommentId?: string;
      lastMessageText: string;
    },
  ): Promise<string>;
  logAudit(
    tenantId: string,
    entry: {
      event: string;
      entityId?: string;
      entityType?: string;
      platform?: string;
      ruleId?: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<void>;
  getStats(tenantId: string): Promise<{
    totalComments: number;
    pendingComments: number;
    repliedComments: number;
    autoRepliedComments: number;
    activeRules: number;
    connectedAccounts: number;
  }>;
  listAccountsWithExpiringTokens(
    daysUntilExpiry: number,
  ): Promise<SocialAccount[]>;
  updateAccountToken(
    tenantId: string,
    accountId: string,
    accessToken: string,
    tokenExpiresAt: Date,
  ): Promise<void>;
}

export const SOCIAL_REPOSITORY = Symbol('ISocialRepository');
