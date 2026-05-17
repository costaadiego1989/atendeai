import { Injectable } from '@nestjs/common';
import {
  ISocialPlatformAdapter,
  InboxMessageContent,
  ExternalComment,
  ExternalPost,
} from '../../domain/ports/ISocialPlatformAdapter';

@Injectable()
export class LinkedInAdapter implements ISocialPlatformAdapter {
  readonly platform = 'LINKEDIN';

  async replyToComment(
    _accessToken: string,
    _commentExternalId: string,
    _text: string,
  ): Promise<{ success: boolean; replyId?: string; error?: string }> {
    return {
      success: false,
      error: 'LinkedIn integration is coming soon (Em breve)',
    };
  }

  async sendInboxMessage(
    _accessToken: string,
    _recipientId: string,
    _content: InboxMessageContent,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    return {
      success: false,
      error: 'LinkedIn integration is coming soon (Em breve)',
    };
  }

  async deleteComment(
    _accessToken: string,
    _commentExternalId: string,
  ): Promise<{ success: boolean; error?: string }> {
    return {
      success: false,
      error: 'LinkedIn integration is coming soon (Em breve)',
    };
  }

  async hideComment(
    _accessToken: string,
    _commentExternalId: string,
    _hidden: boolean,
  ): Promise<{ success: boolean; error?: string }> {
    return {
      success: false,
      error: 'LinkedIn integration is coming soon (Em breve)',
    };
  }

  async fetchComments(
    _accessToken: string,
    _postExternalId: string,
    _cursor?: string,
  ): Promise<{ comments: ExternalComment[]; nextCursor?: string }> {
    return { comments: [] };
  }

  async fetchPostDetails(
    _accessToken: string,
    _postExternalId: string,
  ): Promise<ExternalPost | null> {
    return null;
  }
}
