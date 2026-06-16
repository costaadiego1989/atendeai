import { Injectable } from '@nestjs/common';
import {
  IMessagingGateway,
  MessagingChannel,
  MessagingProvider,
} from '../../domain/ports/IMessagingGateway';
import { IMessagingGatewayRegistry } from '../../domain/ports/IMessagingGatewayRegistry';
import { BubbleWhatsAdapter } from './BubbleWhatsAdapter';
import { InstagramGraphAdapter } from './InstagramGraphAdapter';
import { Dialog360Adapter } from './Dialog360Adapter';
import { TwilioAdapter } from './TwilioAdapter';
import { WhatsAppCloudApiAdapter } from './WhatsAppCloudApiAdapter';
import { WebChatWidgetAdapter } from './WebChatWidgetAdapter';

@Injectable()
export class MessagingGatewayRegistry implements IMessagingGatewayRegistry {
  private readonly gateways = new Map<string, IMessagingGateway>();

  constructor(
    bubbleWhatsAdapter: BubbleWhatsAdapter,
    dialog360Adapter: Dialog360Adapter,
    twilioAdapter: TwilioAdapter,
    whatsAppCloudApiAdapter: WhatsAppCloudApiAdapter,
    instagramGraphAdapter: InstagramGraphAdapter,
    webChatWidgetAdapter: WebChatWidgetAdapter,
  ) {
    this.gateways.set(
      this.getKey(bubbleWhatsAdapter.channel, bubbleWhatsAdapter.provider),
      bubbleWhatsAdapter,
    );
    this.gateways.set(
      this.getKey(dialog360Adapter.channel, dialog360Adapter.provider),
      dialog360Adapter,
    );
    this.gateways.set(
      this.getKey(twilioAdapter.channel, twilioAdapter.provider),
      twilioAdapter,
    );
    this.gateways.set(
      this.getKey(
        whatsAppCloudApiAdapter.channel,
        whatsAppCloudApiAdapter.provider,
      ),
      whatsAppCloudApiAdapter,
    );
    this.gateways.set(
      this.getKey(
        instagramGraphAdapter.channel,
        instagramGraphAdapter.provider,
      ),
      instagramGraphAdapter,
    );
    this.gateways.set(
      this.getKey(webChatWidgetAdapter.channel, webChatWidgetAdapter.provider),
      webChatWidgetAdapter,
    );
  }

  resolve(
    channel: MessagingChannel,
    provider: MessagingProvider,
  ): IMessagingGateway | null {
    return this.gateways.get(this.getKey(channel, provider)) ?? null;
  }

  resolveAll(channel: MessagingChannel): IMessagingGateway[] {
    return Array.from(this.gateways.values()).filter(
      (gateway) => gateway.channel === channel,
    );
  }

  private getKey(
    channel: MessagingChannel,
    provider: MessagingProvider,
  ): string {
    return `${channel}:${provider}`;
  }
}
