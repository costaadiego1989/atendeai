import { Module } from '@nestjs/common';
import { BubbleWhatsAdapter } from './acl/BubbleWhatsAdapter';
import { Dialog360Adapter } from './acl/Dialog360Adapter';
import { TwilioAdapter } from './acl/TwilioAdapter';
import { WhatsAppCloudApiAdapter } from './acl/WhatsAppCloudApiAdapter';
import { InstagramGraphAdapter } from './acl/InstagramGraphAdapter';
import { WebChatWidgetAdapter } from './acl/WebChatWidgetAdapter';
import { MessagingGatewayRegistry } from './acl/MessagingGatewayRegistry';
import { WhatsAppTemplateMessageAdapter } from './acl/WhatsAppTemplateMessageAdapter';
import { PrismaConversationRepository } from './persistence/repositories/PrismaConversationRepository';
import { PrismaConversationIntelligenceRepository } from './persistence/repositories/PrismaConversationIntelligenceRepository';
import { CONVERSATION_REPOSITORY } from '../domain/repositories/IConversationRepository';
import { CONVERSATION_INTELLIGENCE_REPOSITORY } from '../domain/repositories/IConversationIntelligenceRepository';
import { MESSAGING_GATEWAY_REGISTRY } from '../domain/ports/IMessagingGatewayRegistry';
import { WHATSAPP_TEMPLATE_SENDER } from '../application/ports/IWhatsAppTemplateSender';

@Module({
  providers: [
    BubbleWhatsAdapter,
    Dialog360Adapter,
    TwilioAdapter,
    WhatsAppCloudApiAdapter,
    InstagramGraphAdapter,
    WebChatWidgetAdapter,
    MessagingGatewayRegistry,
    WhatsAppTemplateMessageAdapter,
    {
      provide: WHATSAPP_TEMPLATE_SENDER,
      useExisting: WhatsAppTemplateMessageAdapter,
    },
    {
      provide: CONVERSATION_REPOSITORY,
      useClass: PrismaConversationRepository,
    },
    {
      provide: CONVERSATION_INTELLIGENCE_REPOSITORY,
      useClass: PrismaConversationIntelligenceRepository,
    },
    {
      provide: MESSAGING_GATEWAY_REGISTRY,
      useExisting: MessagingGatewayRegistry,
    },
  ],
  exports: [
    BubbleWhatsAdapter,
    Dialog360Adapter,
    TwilioAdapter,
    WhatsAppCloudApiAdapter,
    InstagramGraphAdapter,
    WebChatWidgetAdapter,
    MessagingGatewayRegistry,
    WhatsAppTemplateMessageAdapter,
    WHATSAPP_TEMPLATE_SENDER,
    CONVERSATION_REPOSITORY,
    CONVERSATION_INTELLIGENCE_REPOSITORY,
    MESSAGING_GATEWAY_REGISTRY,
  ],
})
export class MessagingInfrastructureModule {}
