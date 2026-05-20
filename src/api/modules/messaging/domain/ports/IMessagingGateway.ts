export type MessagingChannel = 'WHATSAPP' | 'INSTAGRAM' | 'WEB_CHAT';
export type MessagingProvider =
  | 'BUBBLEWHATS'
  | 'TWILIO'
  | 'D360'
  | 'META_GRAPH'
  | 'WIDGET';

export interface MessagingProviderConfig {
  channel: MessagingChannel;
  provider: MessagingProvider;
  credentials: Record<string, string>;
  status: string;
  webhookSecret?: string | null;
  externalAccountId?: string;
}

export interface MessagingContent {
  type: string;
  text?: string;
  url?: string;
}

export interface IMessagingGateway {
  readonly channel: MessagingChannel;
  readonly provider: MessagingProvider;
  sendMessage(
    config: MessagingProviderConfig,
    to: string,
    content: MessagingContent,
  ): Promise<{ success: boolean; messageId?: string; error?: string }>;
  validateSignature(
    signature: string,
    body: Record<string, unknown>,
    config: MessagingProviderConfig,
    context?: {
      requestUrl?: string;
      headers?: Record<string, string | string[] | undefined>;
    },
  ): boolean;
  parseInboundMessage(body: Record<string, unknown>): unknown;
}

export const MESSAGING_GATEWAY = Symbol('IMessagingGateway');
