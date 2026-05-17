import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import {
  IMessagingGateway,
  MessagingContent,
  MessagingProviderConfig,
} from '../../domain/ports/IMessagingGateway';

export interface Dialog360InboundData {
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
export class Dialog360Adapter implements IMessagingGateway {
  readonly channel = 'WHATSAPP' as const;
  readonly provider = 'D360' as const;
  private readonly fallbackBaseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.fallbackBaseUrl =
      this.configService.get<string>('D360_BASE_URL') ||
      'https://waba-v2.360dialog.io';
  }

  validateSignature(
    _signature: string,
    _body: Record<string, unknown>,
    _config: MessagingProviderConfig,
    _context?: {
      requestUrl?: string;
      headers?: Record<string, string | string[] | undefined>;
    },
  ): boolean {
    return true;
  }

  parseInboundMessage(
    body: Record<string, unknown>,
  ): Dialog360InboundData | null {
    const entry = Array.isArray(body.entry)
      ? (body.entry[0] as Record<string, any> | undefined)
      : undefined;
    const change = Array.isArray(entry?.changes)
      ? (entry?.changes[0] as Record<string, any> | undefined)
      : undefined;
    const value = change?.value as Record<string, any> | undefined;
    const message = Array.isArray(value?.messages)
      ? (value?.messages[0] as Record<string, any> | undefined)
      : undefined;

    if (!message?.id || !message?.from) {
      return null;
    }

    const type = (message.type || 'text') as Dialog360InboundData['type'];
    const from = this.toDigits(message.from);
    if (!from) {
      return null;
    }
    const text = message.text?.body;
    const mediaLink =
      message.image?.link ||
      message.video?.link ||
      message.audio?.link ||
      message.document?.link;

    return {
      messageId: message.id,
      from,
      to: this.toDigits(value?.metadata?.display_phone_number),
      deviceId: value?.metadata?.phone_number_id,
      type,
      content: {
        ...(typeof text === 'string' ? { text } : {}),
        ...(typeof mediaLink === 'string' ? { url: mediaLink } : {}),
      },
      timestamp: message.timestamp
        ? new Date(Number(message.timestamp) * 1000).toISOString()
        : new Date().toISOString(),
    };
  }

  async sendMessage(
    config: MessagingProviderConfig,
    to: string,
    content: MessagingContent,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const baseUrl = config.credentials.baseUrl || this.fallbackBaseUrl;
    const apiKey = config.credentials.apiKey;

    if (!baseUrl || !apiKey) {
      return {
        success: false,
        error: '360dialog credentials are incomplete for this tenant',
      };
    }

    const digits = to.replace(/\D/g, '');

    try {
      const response = await axios.post(
        `${baseUrl}/messages`,
        this.buildPayload(digits, content),
        {
          headers: {
            'Content-Type': 'application/json',
            'D360-API-KEY': apiKey,
          },
        },
      );

      return {
        success: true,
        messageId: response.data?.messages?.[0]?.id || `d360-${Date.now()}`,
      };
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message;
      return { success: false, error: errorMessage };
    }
  }

  private buildPayload(
    to: string,
    content: MessagingContent,
  ): Record<string, unknown> {
    if (content.type.toLowerCase() === 'image' && content.url) {
      return {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'image',
        image: {
          link: content.url,
        },
      };
    }

    return {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: {
        body: content.text || '',
      },
    };
  }

  private toDigits(value?: string): string | undefined {
    if (!value) {
      return undefined;
    }

    const digits = value.replace(/\D/g, '');
    return digits.length > 0 ? digits : undefined;
  }
}
