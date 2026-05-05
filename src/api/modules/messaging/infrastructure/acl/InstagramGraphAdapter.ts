import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IMessagingGateway,
  MessagingContent,
  MessagingProviderConfig,
} from '../../domain/ports/IMessagingGateway';

@Injectable()
export class InstagramGraphAdapter implements IMessagingGateway {
  readonly channel = 'INSTAGRAM' as const;
  readonly provider = 'META_GRAPH' as const;

  constructor(private readonly configService: ConfigService) {}

  validateSignature(
    _signature: string,
    _body: Record<string, unknown>,
    config: MessagingProviderConfig,
    _context?: {
      requestUrl?: string;
      headers?: Record<string, string | string[] | undefined>;
    },
  ): boolean {
    return !!config.webhookSecret;
  }

  parseInboundMessage(): unknown {
    return null;
  }

  async sendMessage(
    config: MessagingProviderConfig,
    to: string,
    content: MessagingContent,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const graphVersion =
      this.configService.get<string>('META_GRAPH_API_VERSION') || 'v21.0';
    const accessToken = config.credentials.accessToken;

    if (!accessToken?.trim()) {
      return {
        success: false,
        error:
          'Instagram Graph API not configured for this tenant yet',
      };
    }

    return {
      success: false,
      error: `Instagram Graph outbound is not implemented yet (${graphVersion})`,
    };
  }
}
