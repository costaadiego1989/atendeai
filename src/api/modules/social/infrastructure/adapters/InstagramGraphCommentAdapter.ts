import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import {
  ISocialPlatformAdapter,
  InboxMessageContent,
  ExternalComment,
  ExternalPost,
} from '../../domain/ports/ISocialPlatformAdapter';

@Injectable()
export class InstagramGraphCommentAdapter implements ISocialPlatformAdapter {
  readonly platform = 'INSTAGRAM';

  constructor(private readonly configService: ConfigService) { }

  private get graphVersion(): string {
    return this.configService.get<string>('META_GRAPH_API_VERSION') || 'v21.0';
  }

  private get baseUrl(): string {
    return `https://graph.facebook.com/${this.graphVersion}`;
  }

  async replyToComment(
    accessToken: string,
    commentExternalId: string,
    text: string,
  ): Promise<{ success: boolean; replyId?: string; error?: string }> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/${commentExternalId}/replies`,
        { message: text },
        { params: { access_token: accessToken } },
      );
      return { success: true, replyId: response.data?.id };
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err.message;
      console.error(`[InstagramGraphCommentAdapter] replyToComment failed: ${msg}`);
      return { success: false, error: msg };
    }
  }

  async sendInboxMessage(
    accessToken: string,
    recipientId: string,
    content: InboxMessageContent,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const pageId = this.configService.get<string>('META_PAGE_ID') || '';

      let message: Record<string, unknown>;

      if (content.imageUrl) {
        message = {
          attachment: {
            type: 'image',
            payload: { url: content.imageUrl, is_reusable: true },
          },
        };
      } else if (content.videoUrl) {
        message = {
          attachment: {
            type: 'video',
            payload: { url: content.videoUrl, is_reusable: true },
          },
        };
      } else if (content.audioUrl) {
        message = {
          attachment: {
            type: 'audio',
            payload: { url: content.audioUrl, is_reusable: true },
          },
        };
      } else if (content.linkUrl) {
        const linkText = content.linkTitle
          ? `${content.text || ''}\n\n🔗 ${content.linkTitle}: ${content.linkUrl}`
          : `${content.text || ''}\n\n🔗 ${content.linkUrl}`;
        message = { text: linkText.trim() };
      } else {
        message = { text: content.text || '' };
      }

      const response = await axios.post(
        `${this.baseUrl}/${pageId}/messages`,
        {
          recipient: { id: recipientId },
          message,
        },
        { params: { access_token: accessToken } },
      );

      return { success: true, messageId: response.data?.message_id };
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err.message;
      console.error(`[InstagramGraphCommentAdapter] sendInboxMessage failed: ${msg}`);
      return { success: false, error: msg };
    }
  }

  async deleteComment(
    accessToken: string,
    commentExternalId: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await axios.delete(`${this.baseUrl}/${commentExternalId}`, {
        params: { access_token: accessToken },
      });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.response?.data?.error?.message || err.message };
    }
  }

  async hideComment(
    accessToken: string,
    commentExternalId: string,
    hidden: boolean,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await axios.post(
        `${this.baseUrl}/${commentExternalId}`,
        { hide: hidden },
        { params: { access_token: accessToken } },
      );
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.response?.data?.error?.message || err.message };
    }
  }

  async fetchComments(
    accessToken: string,
    postExternalId: string,
    cursor?: string,
  ): Promise<{ comments: ExternalComment[]; nextCursor?: string }> {
    try {
      const params: Record<string, string> = {
        access_token: accessToken,
        fields: 'id,text,timestamp,from{id,username},parent_id',
        limit: '50',
      };
      if (cursor) params.after = cursor;

      const response = await axios.get(
        `${this.baseUrl}/${postExternalId}/comments`,
        { params },
      );

      const raw = response.data?.data || [];
      const comments: ExternalComment[] = raw.map((c: any) => ({
        externalCommentId: c.id,
        parentCommentId: c.parent_id || undefined,
        authorExternalId: c.from?.id || '',
        authorUsername: c.from?.username || '',
        text: c.text || '',
        timestamp: new Date(c.timestamp),
      }));

      const nextCursor = response.data?.paging?.cursors?.after;
      return { comments, nextCursor };
    } catch (err: any) {
      console.error(`[InstagramGraphCommentAdapter] fetchComments failed: ${err.message}`);
      return { comments: [] };
    }
  }

  async fetchPostDetails(
    accessToken: string,
    postExternalId: string,
  ): Promise<ExternalPost | null> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/${postExternalId}`,
        {
          params: {
            access_token: accessToken,
            fields: 'id,media_type,caption,media_url,permalink,timestamp',
          },
        },
      );

      const d = response.data;
      return {
        externalPostId: d.id,
        postType: d.media_type || 'IMAGE',
        caption: d.caption,
        mediaUrl: d.media_url,
        permalink: d.permalink,
        timestamp: d.timestamp ? new Date(d.timestamp) : undefined,
      };
    } catch (err: any) {
      console.error(`[InstagramGraphCommentAdapter] fetchPostDetails failed: ${err.message}`);
      return null;
    }
  }
}
