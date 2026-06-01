export interface WhatsAppConfig {
  provider: 'BUBBLEWHATS' | 'TWILIO' | 'D360';
  credentials: Record<string, string>;
  webhookSecret?: string | null;
  whatsappNumber: string;
  status: string;
  branchId?: string | null;
}

export interface InstagramConfig {
  provider: 'META_GRAPH';
  credentials: Record<string, string>;
  instagramAccountId: string;
  webhookSecret?: string | null;
  status: string;
}

export type MessagingProvider =
  | 'BUBBLEWHATS'
  | 'TWILIO'
  | 'D360'
  | 'META_GRAPH'
  | 'WIDGET';

export type MessagingChannel = 'WHATSAPP' | 'INSTAGRAM' | 'WEB_CHAT';

export interface MessagingChannelConfig {
  channel: MessagingChannel;
  provider: MessagingProvider;
  credentials: Record<string, string>;
  status: string;
  webhookSecret?: string | null;
  externalAccountId?: string;
  branchId?: string | null;
}

export interface ITenantFacade {
  tenantExists(tenantId: string): Promise<boolean>;
  getTenantName(tenantId: string): Promise<string | null>;
  getWhatsAppConfig(tenantId: string): Promise<WhatsAppConfig | null>;
  getInstagramConfig(tenantId: string): Promise<InstagramConfig | null>;
  getWhatsAppConfigByNumber(
    phoneNumber?: string | null,
    bubbleWhatsId?: string | null,
  ): Promise<{
    tenantId: string;
    branchId?: string | null;
    config: WhatsAppConfig;
  } | null>;
  getChannelConfig(
    tenantId: string,
    channel: MessagingChannel,
    branchId?: string | null,
  ): Promise<MessagingChannelConfig | null>;
}

export const TENANT_FACADE = Symbol('ITenantFacade');
