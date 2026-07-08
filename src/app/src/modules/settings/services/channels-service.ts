import { apiClient } from '@/shared/api/client';
import type { WhatsAppConnection } from '@/shared/types';

export interface RegisterTwilioSenderInput {
  phoneNumber: string;
  wabaId?: string;
  branchId?: string;
  verificationMethod?: 'sms' | 'voice';
  profileName?: string;
  about?: string;
  address?: string;
  description?: string;
  logoUrl?: string;
}

export interface ConfigureInstagramChannelInput {
  instagramAccountId: string;
  branchId?: string;
}

export interface InstagramMetaDiscoveredAccount {
  instagramAccountId: string;
  username: string | null;
  pageId: string;
  pageName: string | null;
  profilePictureUrl: string | null;
}

export const channelsService = {
  async getWhatsAppConnection(
    tenantId: string,
    branchId?: string | null,
  ): Promise<WhatsAppConnection> {
    const query = branchId ? `?branchId=${encodeURIComponent(branchId)}` : '';
    return apiClient.get<WhatsAppConnection>(`/tenants/${tenantId}/whatsapp-connection${query}`);
  },

  async registerTwilioSender(
    tenantId: string,
    input: RegisterTwilioSenderInput,
  ): Promise<{
    provider: 'TWILIO';
    senderSid: string;
    senderId: string;
    status: string;
    whatsappNumber: string;
    verificationRequired: boolean;
  }> {
    return apiClient.post(`/tenants/${tenantId}/whatsapp/twilio/sender`, input);
  },

  async verifyTwilioSender(
    tenantId: string,
    verificationCode: string,
    branchId?: string | null,
  ): Promise<{
    provider: 'TWILIO';
    senderSid: string;
    senderId: string;
    status: string;
    verificationRequired: boolean;
  }> {
    return apiClient.post(`/tenants/${tenantId}/whatsapp/twilio/verify`, {
      verificationCode,
      ...(branchId ? { branchId } : {}),
    });
  },

  async refreshTwilioSenderStatus(tenantId: string, branchId?: string | null): Promise<{
    provider: 'TWILIO';
    senderSid: string;
    senderId: string;
    status: string;
    verificationRequired: boolean;
  }> {
    const query = branchId ? `?branchId=${encodeURIComponent(branchId)}` : '';
    return apiClient.post(`/tenants/${tenantId}/whatsapp/twilio/refresh${query}`, {});
  },

  async configureInstagram(
    tenantId: string,
    input: ConfigureInstagramChannelInput,
  ): Promise<{
    id: string;
    instagramAccountId: string;
    status: string;
    configuredAt: string;
  }> {
    return apiClient.put(`/tenants/${tenantId}/instagram-config`, input);
  },

  async startInstagramMetaConnection(
    branchId?: string | null,
  ): Promise<{ authorizationUrl: string }> {
    return apiClient.post('/channels/instagram/meta/start', branchId ? { branchId } : {});
  },

  async connectMetaWhatsApp(
    tenantId: string,
    input: {
      code: string;
      phoneNumberId: string;
      wabaId: string;
      whatsappNumber: string;
      businessId?: string;
      webhookSecret?: string;
      branchId?: string | null;
    },
  ): Promise<{
    id: string;
    provider: 'META_CLOUD';
    whatsappNumber: string;
    status: string;
    configuredAt: string;
  }> {
    return apiClient.post(`/tenants/${tenantId}/whatsapp/meta/connect`, input);
  },

  async refreshMetaWhatsAppStatus(
    tenantId: string,
    branchId?: string | null,
  ): Promise<{
    id: string;
    provider: 'META_CLOUD';
    whatsappNumber: string;
    status: string;
    configuredAt: string;
  }> {
    const query = branchId ? `?branchId=${encodeURIComponent(branchId)}` : '';
    return apiClient.post(
      `/tenants/${tenantId}/whatsapp/meta/refresh-status${query}`,
      {},
    );
  },
};
