export type CommentStatus = 'PENDING' | 'REPLIED' | 'IGNORED' | 'AUTO_REPLIED';
export type CommentSentiment = 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | 'QUESTION';
export type SocialPlatformType = 'INSTAGRAM' | 'LINKEDIN';

export interface SocialAccount {
  id: string;
  platform: SocialPlatformType;
  username: string | null;
  displayName: string | null;
  profilePictureUrl: string | null;
  status: 'ACTIVE' | 'DISCONNECTED' | 'TOKEN_EXPIRED';
  connectedAt: string;
}

export interface SocialComment {
  id: string;
  platform: SocialPlatformType;
  postId: string;
  externalCommentId: string;
  authorUsername: string | null;
  authorName: string | null;
  text: string;
  sentiment: CommentSentiment | null;
  status: CommentStatus;
  isHidden: boolean;
  receivedAt: string;
  repliedAt: string | null;
}

export interface SocialCommentReply {
  id: string;
  text: string;
  repliedBy: 'AI' | 'HUMAN';
  ruleId?: string;
  status: 'SENT' | 'FAILED' | 'DELETED';
  createdAt: string;
}

export interface SocialAutoReplyRule {
  id: string;
  name: string;
  isActive: boolean;
  priority: number;
  platform: string;
  conditions: Record<string, unknown>;
  actions: Record<string, unknown>;
  limits: Record<string, unknown>;
  totalFired: number;
  lastFiredAt: string | null;
  createdAt: string;
}

export interface SocialRuleConditions {
  keywords?: string[];
  excludeKeywords?: string[];
  postIds?: string[];
}

export interface SocialRuleActions {
  replyToComment: {
    enabled: boolean;
    mode: 'AI_GENERATED' | 'TEMPLATE';
    aiPrompt?: string;
    templates?: string[];
  };
  sendInboxMessage: {
    enabled: boolean;
    delaySeconds: number;
    mode: 'AI_GENERATED' | 'TEMPLATE';
    aiPrompt?: string;
    templates?: string[];
  };
}

export interface CreateSocialRuleInput {
  name: string;
  platform: string;
  priority: number;
  conditions: SocialRuleConditions;
  actions: SocialRuleActions;
  limits: {
    maxRepliesPerPost: number;
    maxRepliesPerHour: number;
    cooldownPerUser: number;
  };
}

export interface ConnectInstagramPayload {
  code: string;
  instagramAccountId: string;
  username?: string;
  displayName?: string;
  profilePictureUrl?: string;
  pageId?: string;
}

export interface SendInboxMessagePayload {
  socialAccountId: string;
  recipientExternalId: string;
  recipientUsername?: string;
  text?: string;
  imageUrl?: string;
  videoUrl?: string;
  linkUrl?: string;
  linkTitle?: string;
  originCommentId?: string;
}
