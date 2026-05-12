export const SOCIAL_DELAYED_JOB_QUEUE = Symbol('SOCIAL_DELAYED_JOB_QUEUE');

export interface DelayedInboxMessagePayload {
  tenantId: string;
  accountId: string;
  recipientId: string;
  text: string;
  mediaAttachments?: Array<{
    type: string;
    url: string;
    caption?: string;
  }>;
  delayMs: number;
  /** Needed to send the message via the platform adapter */
  accessToken: string;
  /** Social account ID for thread upsert */
  socialAccountId: string;
  platform: string;
  commentId: string;
  ruleId: string;
  recipientUsername?: string;
}

export interface ISocialDelayedJobQueue {
  addDelayedInboxMessage(payload: DelayedInboxMessagePayload): Promise<void>;
}
