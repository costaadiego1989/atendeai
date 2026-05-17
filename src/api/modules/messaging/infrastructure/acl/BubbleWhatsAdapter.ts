import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as crypto from 'crypto';
import {
  IMessagingGateway,
  MessagingContent,
  MessagingProviderConfig,
} from '../../domain/ports/IMessagingGateway';

export interface BubbleWhatsInboundData {
  messageId: string;
  from: string;
  to?: string;
  deviceId?: string;
  type: 'text' | 'image' | 'audio' | 'video' | 'document';
  content: {
    text?: string;
    url?: string;
  };
  timestamp: string;
}

@Injectable()
export class BubbleWhatsAdapter implements IMessagingGateway {
  readonly channel = 'WHATSAPP' as const;
  readonly provider = 'BUBBLEWHATS' as const;
  private readonly fallbackBaseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.fallbackBaseUrl =
      this.configService.get<string>('BUBBLEWHATS_API_URL') || '';
  }

  validateSignature(
    signature: string,
    body: Record<string, unknown>,
    config: MessagingProviderConfig,
    _context?: {
      requestUrl?: string;
      headers?: Record<string, string | string[] | undefined>;
    },
  ): boolean {
    const secret = config.webhookSecret ?? config.credentials.webhookSecret;
    if (!secret) {
      return true;
    }

    if (!signature || !secret) return false;

    const hmac = crypto.createHmac('sha256', secret);
    const digest = hmac.update(JSON.stringify(body)).digest('hex');

    return signature === digest;
  }

  parseInboundMessage(
    body: Record<string, unknown>,
  ): BubbleWhatsInboundData | null {
    const eventPayload = this.parseEventPayload(body);
    if (eventPayload) {
      return eventPayload;
    }

    const nativePayload = this.parseNativePayload(body);
    if (nativePayload) {
      return nativePayload;
    }

    const arrayPayload = this.parseSimpleArrayPayload(body);
    if (arrayPayload) {
      return arrayPayload;
    }

    return this.parseMessageContextPayload(body);
  }

  async sendMessage(
    config: MessagingProviderConfig,
    to: string,
    content: MessagingContent,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const apiUrl =
      config.credentials.apiUrl ||
      config.credentials.baseUrl ||
      this.fallbackBaseUrl;
    const token = config.credentials.token;

    if (!apiUrl || !token) {
      return {
        success: false,
        error: 'BubbleWhats credentials are incomplete for this tenant',
      };
    }

    try {
      const jid = this.formatPhoneNumber(to);
      const response = await axios.post(
        `${apiUrl}/send-message`,
        {
          jid,
          message: content.text,
        },
        {
          headers: {
            Authorization: token,
            'Content-Type': 'application/json',
          },
        },
      );

      return {
        success: true,
        messageId: response.data?.messageId || `bw-${Date.now()}`,
      };
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message;
      console.error('BubbleWhats API Error:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  private parseEventPayload(
    body: Record<string, unknown>,
  ): BubbleWhatsInboundData | null {
    if (body.event !== 'message.received') {
      return null;
    }

    const data = body.data as BubbleWhatsInboundData | undefined;
    if (!data?.messageId || !data.from) {
      return null;
    }

    return {
      messageId: data.messageId,
      from: data.from,
      to: data.to,
      deviceId: data.deviceId,
      type: data.type || 'text',
      content: data.content || {},
      timestamp: data.timestamp || new Date().toISOString(),
    };
  }

  private parseNativePayload(
    body: Record<string, unknown>,
  ): BubbleWhatsInboundData | null {
    const messages = Array.isArray(body.messages)
      ? (body.messages as Array<Record<string, any>>)
      : null;

    if (!messages?.length || !messages[0]?.key) {
      return null;
    }

    const candidate = messages.find((message) => {
      if (message.update) {
        return false;
      }
      if (message.key?.fromMe === true) {
        return false;
      }

      const text =
        message.message?.conversation ||
        message.message?.extendedTextMessage?.text;

      return typeof text === 'string' && text.trim().length > 0;
    });

    if (!candidate) {
      return null;
    }

    const remoteJid = candidate.key?.remoteJid as string | undefined;
    const from = this.extractPhoneFromJid(remoteJid);
    const text =
      candidate.message?.conversation ||
      candidate.message?.extendedTextMessage?.text;

    if (!from || !text) {
      return null;
    }

    return {
      messageId: candidate.key?.id || `bw-native-${Date.now()}`,
      from,
      to: this.readString(body.toNumber),
      deviceId: this.readString(body.deviceID) || this.readString(body.id),
      type: 'text',
      content: { text: text.trim() },
      timestamp: candidate.messageTimestamp
        ? new Date(Number(candidate.messageTimestamp) * 1000).toISOString()
        : new Date().toISOString(),
    };
  }

  private parseSimpleArrayPayload(
    body: Record<string, unknown>,
  ): BubbleWhatsInboundData | null {
    const messages = Array.isArray(body.messages)
      ? (body.messages as Array<Record<string, any>>)
      : null;

    if (
      !messages?.length ||
      !('from' in messages[0]) ||
      !('body' in messages[0])
    ) {
      return null;
    }

    const candidate = messages.find(
      (message) =>
        typeof message.from === 'string' &&
        typeof message.body === 'string' &&
        message.body.trim().length > 0,
    );

    if (!candidate) {
      return null;
    }

    return {
      messageId:
        this.readString(candidate.id) ||
        this.readString(body.id) ||
        `bw-array-${Date.now()}`,
      from: candidate.from,
      to: this.readString(body.toNumber),
      deviceId: this.readString(body.deviceID),
      type: 'text',
      content: { text: candidate.body.trim() },
      timestamp: candidate.timestamp
        ? new Date(Number(candidate.timestamp) * 1000).toISOString()
        : new Date().toISOString(),
    };
  }

  private parseMessageContextPayload(
    body: Record<string, unknown>,
  ): BubbleWhatsInboundData | null {
    const fromMe = (body.messageContext as any)?.key?.fromMe;
    if (fromMe === true && !this.readString(body.fromAlias)) {
      return null;
    }

    const from = this.readString(body.from) || this.readString(body.fromNumber);
    const text =
      this.readString(body.body) ||
      this.readString(
        (body.messageContext as any)?.message?.extendedTextMessage?.text,
      ) ||
      this.readString((body.messageContext as any)?.message?.conversation);

    if (!from || !text) {
      return null;
    }

    return {
      messageId: this.readString(body.id) || `bw-context-${Date.now()}`,
      from,
      to: this.readString(body.toNumber),
      deviceId: this.readString(body.deviceID),
      type: 'text',
      content: { text: text.trim() },
      timestamp: new Date().toISOString(),
    };
  }

  private extractPhoneFromJid(remoteJid?: string): string | null {
    if (!remoteJid) {
      return null;
    }

    const match = remoteJid.match(/^(\d+)@/);
    return match ? match[1] : null;
  }

  private readString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim().length > 0
      ? value
      : undefined;
  }

  private formatPhoneNumber(phoneNumber: string): string {
    const digits = phoneNumber.replace(/\D/g, '');
    return digits.startsWith('55') ? digits : `55${digits}`;
  }
}
