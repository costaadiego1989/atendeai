import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as crypto from 'crypto';
import {
  IMessagingGateway,
  MessagingContent,
  MessagingProviderConfig,
} from '../../domain/ports/IMessagingGateway';

export const META_WHATSAPP_RAW_BODY_HEADER = 'x-internal-raw-body';

const DEFAULT_SEND_TIMEOUT_MS = 10000;

export interface WhatsAppCloudInboundData {
  messageId: string;
  from: string;
  to?: string;
  deviceId?: string;
  type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'status';
  content: {
    text?: string;
    url?: string;
    mimeType?: string;
  };
  timestamp: string;
}

interface CloudApiValue {
  metadata?: {
    display_phone_number?: string;
    phone_number_id?: string;
  };
  messages?: Array<{
    id?: string;
    from?: string;
    type?: string;
    timestamp?: string;
    text?: { body?: string };
    image?: { id?: string; mime_type?: string };
    audio?: { id?: string; mime_type?: string };
    video?: { id?: string; mime_type?: string };
    document?: { id?: string; mime_type?: string };
  }>;
  statuses?: Array<{
    id?: string;
    status?: string;
    recipient_id?: string;
    timestamp?: string;
  }>;
}

@Injectable()
export class WhatsAppCloudApiAdapter implements IMessagingGateway {
  readonly channel = 'WHATSAPP' as const;
  readonly provider = 'META_GRAPH' as const;

  constructor(private readonly configService: ConfigService) {}

  validateSignature(
    signature: string,
    _body: Record<string, unknown>,
    config: MessagingProviderConfig,
    context?: {
      requestUrl?: string;
      headers?: Record<string, string | string[] | undefined>;
    },
  ): boolean {
    const appSecret =
      config.webhookSecret ||
      this.configService.get<string>('META_APP_SECRET') ||
      '';

    if (!appSecret || !signature) {
      return false;
    }

    const rawBody = this.readRawBody(context?.headers);
    if (rawBody == null) {
      return false;
    }

    const normalizedSignature = signature.startsWith('sha256=')
      ? signature.slice('sha256='.length)
      : signature;

    const expected = crypto
      .createHmac('sha256', appSecret)
      .update(rawBody)
      .digest('hex');

    const provided = Buffer.from(normalizedSignature, 'utf8');
    const computed = Buffer.from(expected, 'utf8');

    if (provided.length !== computed.length) {
      return false;
    }

    return crypto.timingSafeEqual(provided, computed);
  }

  parseInboundMessage(
    body: Record<string, unknown>,
  ): WhatsAppCloudInboundData | null {
    const value = this.extractValue(body);
    if (!value) {
      return null;
    }

    const deviceId = value.metadata?.phone_number_id;
    const to = this.toDigits(value.metadata?.display_phone_number);

    const message = value.messages?.[0];
    if (message) {
      const type = this.mapMessageType(message.type);
      const media =
        message.image ||
        message.audio ||
        message.video ||
        message.document ||
        undefined;

      return {
        messageId: message.id ?? '',
        from: this.toDigits(message.from) ?? '',
        to,
        deviceId,
        type,
        content: {
          ...(message.text?.body ? { text: message.text.body } : {}),
          ...(media?.id ? { url: media.id } : {}),
          ...(media?.mime_type ? { mimeType: media.mime_type } : {}),
        },
        timestamp: this.toIsoTimestamp(message.timestamp),
      };
    }

    const status = value.statuses?.[0];
    if (status) {
      return {
        messageId: status.id ?? '',
        from: this.toDigits(status.recipient_id) ?? '',
        to,
        deviceId,
        type: 'status',
        content: {
          ...(status.status ? { text: status.status } : {}),
        },
        timestamp: this.toIsoTimestamp(status.timestamp),
      };
    }

    return null;
  }

  async sendMessage(
    config: MessagingProviderConfig,
    to: string,
    content: MessagingContent,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const accessToken = config.credentials.accessToken;
    const phoneNumberId = config.credentials.phoneNumberId;

    if (!accessToken || !phoneNumberId) {
      return {
        success: false,
        error: 'Meta WhatsApp credentials are incomplete for this tenant',
      };
    }

    const graphVersion =
      this.configService.get<string>('META_GRAPH_API_VERSION') || 'v21.0';

    try {
      const response = await axios.post(
        `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`,
        this.buildPayload(to, content),
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          timeout: DEFAULT_SEND_TIMEOUT_MS,
        },
      );

      return {
        success: true,
        messageId: response.data?.messages?.[0]?.id,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message,
      };
    }
  }

  private buildPayload(
    to: string,
    content: MessagingContent,
  ): Record<string, unknown> {
    const recipient = to.replace(/\D/g, '');

    if (content.type === 'template') {
      const template = (content as MessagingContent & {
        template?: {
          name: string;
          languageCode: string;
          components?: unknown[];
        };
      }).template;

      return {
        messaging_product: 'whatsapp',
        to: recipient,
        type: 'template',
        template: {
          name: template?.name,
          language: { code: template?.languageCode },
          ...(template?.components ? { components: template.components } : {}),
        },
      };
    }

    return {
      messaging_product: 'whatsapp',
      to: recipient,
      type: 'text',
      text: { body: content.text ?? '' },
    };
  }

  private extractValue(body: Record<string, unknown>): CloudApiValue | null {
    const entry = (body?.entry as Array<Record<string, unknown>>) ?? [];
    for (const item of entry) {
      const changes = (item?.changes as Array<Record<string, unknown>>) ?? [];
      for (const change of changes) {
        const value = change?.value as CloudApiValue | undefined;
        if (value && (value.messages?.length || value.statuses?.length)) {
          return value;
        }
      }
    }
    return null;
  }

  private mapMessageType(
    type?: string,
  ): WhatsAppCloudInboundData['type'] {
    switch (type) {
      case 'image':
      case 'audio':
      case 'video':
      case 'document':
        return type;
      default:
        return 'text';
    }
  }

  private readRawBody(
    headers?: Record<string, string | string[] | undefined>,
  ): string | null {
    if (!headers) {
      return null;
    }
    const raw = headers[META_WHATSAPP_RAW_BODY_HEADER];
    if (typeof raw === 'string') {
      return raw;
    }
    if (Array.isArray(raw) && typeof raw[0] === 'string') {
      return raw[0];
    }
    return null;
  }

  private toDigits(value?: string): string | undefined {
    if (!value) {
      return undefined;
    }
    const digits = value.replace(/\D/g, '');
    return digits.length > 0 ? digits : undefined;
  }

  private toIsoTimestamp(value?: string): string {
    const epoch = value ? Number.parseInt(value, 10) : NaN;
    if (Number.isFinite(epoch) && epoch > 0) {
      return new Date(epoch * 1000).toISOString();
    }
    return new Date().toISOString();
  }
}
