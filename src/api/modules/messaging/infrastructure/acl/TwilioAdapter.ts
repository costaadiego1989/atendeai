import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as crypto from 'crypto';
import {
  IMessagingGateway,
  MessagingContent,
  MessagingProviderConfig,
} from '../../domain/ports/IMessagingGateway';

export interface TwilioInboundData {
  messageId: string;
  from: string;
  to?: string;
  type: 'text' | 'image' | 'audio' | 'video' | 'document';
  content: {
    text?: string;
    url?: string;
    mimeType?: string;
  };
  timestamp: string;
}

@Injectable()
export class TwilioAdapter implements IMessagingGateway {
  readonly channel = 'WHATSAPP' as const;
  readonly provider = 'TWILIO' as const;
  private readonly accountSid: string;
  private readonly authToken: string;
  private readonly apiBaseUrl: string;
  private readonly statusCallbackUrl?: string;

  constructor(private readonly configService: ConfigService) {
    this.accountSid =
      this.configService.get<string>('TWILIO_ACCOUNT_SID') || '';
    this.authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN') || '';
    this.apiBaseUrl =
      this.configService.get<string>('TWILIO_API_BASE_URL') ||
      'https://api.twilio.com/2010-04-01';
    this.statusCallbackUrl = this.configService.get<string>(
      'TWILIO_WHATSAPP_STATUS_CALLBACK_URL',
    );
  }

  validateSignature(
    signature: string,
    body: Record<string, unknown>,
    _config: MessagingProviderConfig,
    context?: {
      requestUrl?: string;
      headers?: Record<string, string | string[] | undefined>;
    },
  ): boolean {
    const authToken = _config.credentials.authToken || this.authToken;
    if (!authToken) {
      return false;
    }

    const requestUrl = context?.requestUrl;
    if (!requestUrl || !signature) {
      return false;
    }

    const payload = Object.keys(body)
      .sort()
      .reduce(
        (acc, key) => `${acc}${key}${String(body[key] ?? '')}`,
        requestUrl,
      );

    const expected = crypto
      .createHmac('sha1', authToken)
      .update(payload)
      .digest('base64');

    if (signature.length !== expected.length) {
      return false;
    }

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected),
    );
  }

  parseInboundMessage(body: Record<string, unknown>): TwilioInboundData | null {
    const messageSid = this.readString(body.MessageSid);
    const from = this.toDigits(
      this.readString(body.WaId) || this.readString(body.From),
    );
    const to = this.toDigits(this.readString(body.To));
    const bodyText = this.readString(body.Body);
    const mediaUrl = this.readString(body.MediaUrl0);
    const mimeType = this.readString(body.MediaContentType0);

    if (!messageSid || !from) {
      return null;
    }

    const type = mediaUrl
      ? ((this.detectMediaType(mimeType) ||
          'image') as TwilioInboundData['type'])
      : 'text';

    return {
      messageId: messageSid,
      from,
      to,
      type,
      content: {
        ...(bodyText ? { text: bodyText } : {}),
        ...(mediaUrl ? { url: mediaUrl } : {}),
        ...(mimeType ? { mimeType } : {}),
      },
      timestamp: new Date().toISOString(),
    };
  }

  async sendMessage(
    config: MessagingProviderConfig,
    to: string,
    content: MessagingContent,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const senderId = config.credentials.senderId;
    const accountSid = config.credentials.accountSid || this.accountSid;
    const authToken = config.credentials.authToken || this.authToken;

    if (!accountSid || !authToken || !senderId) {
      return {
        success: false,
        error: 'Twilio credentials are incomplete for this tenant',
      };
    }

    const params = new URLSearchParams();
    params.set('To', `whatsapp:+${to.replace(/\D/g, '')}`);
    params.set('From', senderId);

    if (content.url && content.type !== 'text') {
      params.set('MediaUrl', content.url);
    }

    if (content.text) {
      params.set('Body', content.text);
    }

    if (this.statusCallbackUrl) {
      params.set('StatusCallback', this.statusCallbackUrl);
    }

    try {
      const response = await axios.post(
        `${this.apiBaseUrl}/Accounts/${accountSid}/Messages.json`,
        params.toString(),
        {
          auth: {
            username: accountSid,
            password: authToken,
          },
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      return {
        success: true,
        messageId: response.data?.sid,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  private readString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim().length > 0
      ? value
      : undefined;
  }

  private toDigits(value?: string): string | undefined {
    if (!value) {
      return undefined;
    }

    const digits = value.replace(/\D/g, '');
    return digits.length > 0 ? digits : undefined;
  }

  private detectMediaType(contentType?: string): string | undefined {
    if (!contentType) {
      return undefined;
    }

    if (contentType.startsWith('image/')) return 'image';
    if (contentType.startsWith('audio/')) return 'audio';
    if (contentType.startsWith('video/')) return 'video';
    return 'document';
  }
}
