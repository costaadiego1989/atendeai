import { Injectable } from '@nestjs/common';
import {
  IMessagingGateway,
  MessagingContent,
  MessagingProviderConfig,
} from '../../domain/ports/IMessagingGateway';

/**
 * Adapter for the WEB_CHAT channel (embed widget).
 *
 * Unlike WhatsApp/Instagram adapters that call external APIs,
 * the widget adapter delivers messages via WebSocket push to the
 * connected widget client. The actual WebSocket delivery is handled
 * by the WidgetRealtimeGateway — this adapter acts as the messaging
 * pipeline integration point.
 */

export interface WebChatInboundData {
  messageId: string;
  sessionId: string;
  visitorId: string;
  type: 'text' | 'image' | 'audio';
  content: { text?: string; url?: string };
  timestamp: string;
}

@Injectable()
export class WebChatWidgetAdapter implements IMessagingGateway {
  readonly channel = 'WEB_CHAT' as const;
  readonly provider = 'WIDGET' as const;

  /**
   * For widget messages, "sending" means pushing via WebSocket.
   * The actual push is done by WidgetRealtimeGateway after this
   * use case completes. We return success immediately since delivery
   * is handled asynchronously via the realtime layer.
   */
  async sendMessage(
    _config: MessagingProviderConfig,
    _to: string,
    _content: MessagingContent,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    // Widget messages are delivered via WebSocket, not external API.
    // The realtime publisher handles actual delivery after message persistence.
    const messageId = crypto.randomUUID();
    return { success: true, messageId };
  }

  /**
   * Widget doesn't use webhook signatures — auth is via public token.
   */
  validateSignature(
    _signature: string,
    _body: Record<string, unknown>,
    _config: MessagingProviderConfig,
  ): boolean {
    return true;
  }

  /**
   * Parse inbound message from widget client.
   */
  parseInboundMessage(
    body: Record<string, unknown>,
  ): WebChatInboundData | null {
    const sessionId = body.sessionId as string;
    const visitorId = body.visitorId as string;
    const text = body.text as string | undefined;
    const type = (body.type as string) || 'text';
    const url = body.url as string | undefined;

    if (!sessionId || !visitorId) return null;
    if (type === 'text' && !text) return null;

    return {
      messageId: crypto.randomUUID(),
      sessionId,
      visitorId,
      type: type as 'text' | 'image' | 'audio',
      content: { text, url },
      timestamp: new Date().toISOString(),
    };
  }
}
