export interface ISocialPlatformAdapter {
  readonly platform: string;

  replyToComment(
    accessToken: string,
    commentExternalId: string,
    text: string,
  ): Promise<{ success: boolean; replyId?: string; error?: string }>;

  sendInboxMessage(
    accessToken: string,
    recipientId: string,
    content: InboxMessageContent,
  ): Promise<{ success: boolean; messageId?: string; error?: string }>;

  deleteComment(
    accessToken: string,
    commentExternalId: string,
  ): Promise<{ success: boolean; error?: string }>;

  hideComment(
    accessToken: string,
    commentExternalId: string,
    hidden: boolean,
  ): Promise<{ success: boolean; error?: string }>;

  fetchComments(
    accessToken: string,
    postExternalId: string,
    cursor?: string,
  ): Promise<{
    comments: ExternalComment[];
    nextCursor?: string;
  }>;

  fetchPostDetails(
    accessToken: string,
    postExternalId: string,
  ): Promise<ExternalPost | null>;
}

export interface InboxMessageContent {
  text?: string;
  imageUrl?: string;
  videoUrl?: string;
  linkUrl?: string;
  linkTitle?: string;
  audioUrl?: string;
}

export interface ExternalComment {
  externalCommentId: string;
  parentCommentId?: string;
  authorExternalId: string;
  authorUsername: string;
  text: string;
  timestamp: Date;
}

export interface ExternalPost {
  externalPostId: string;
  postType: string;
  caption?: string;
  mediaUrl?: string;
  permalink?: string;
  timestamp?: Date;
}

export const SOCIAL_PLATFORM_ADAPTER = Symbol('ISocialPlatformAdapter');
