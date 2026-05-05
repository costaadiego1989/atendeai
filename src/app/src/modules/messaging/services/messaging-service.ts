import { apiClient } from '@/shared/api/client';
import {
  Conversation,
  ConversationStatus,
  Message,
  MessageStatus,
  MessageSender,
} from '@/shared/types';

export interface ConversationSaleAttribution {
  id: string;
  conversationId: string;
  attributedUserId: string;
  saleAmount: string | null;
  currency: string | null;
  lifecycleStatus: string;
  aiValidationStatus: string;
  markedByUserId: string;
  markedAt: string;
  aiValidatedAt: string | null;
  notes: string | null;
}

interface ListConversationsApiResponse {
  data: Array<{
    id: string;
    contactId: string;
    contactName: string;
    contactPhone: string;
    channel: 'WHATSAPP' | 'INSTAGRAM';
    status: ConversationStatus;
    assignedToUserId?: string;
    assignedToName?: string;
    assignedAt?: string;
    unreadCount: number;
    createdAt: string;
    updatedAt: string;
    lastInboundAt?: string;
    lastOutboundAt?: string;
    lastMessageSequence?: number;
    lastMessage?: {
      content: string;
      direction: 'INBOUND' | 'OUTBOUND';
      timestamp: string;
    };
    intelligence?: {
      summary: string;
      sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
      tags: string[];
      interests: string[];
      nextStep?: string | null;
      lossReason?: string | null;
      updatedAt: string;
    };
  }>;
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

interface GetConversationMessagesApiResponse {
  data: Array<{
    id: string;
    direction: 'INBOUND' | 'OUTBOUND';
    contentType: string;
    content: {
      text?: string;
      url?: string;
    };
    sentBy: 'CONTACT' | 'AI' | 'HUMAN' | 'SYSTEM';
    timestamp: string;
    deliveryStatus?: MessageStatus;
  }>;
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

function mapSender(sentBy: 'CONTACT' | 'AI' | 'HUMAN' | 'SYSTEM'): MessageSender {
  if (sentBy === 'HUMAN' || sentBy === 'SYSTEM') {
    return 'AGENT';
  }

  return sentBy;
}

function getMediaLabel(contentType: string): string {
  switch (contentType.toUpperCase()) {
    case 'IMAGE':
      return 'Imagem enviada';
    case 'AUDIO':
      return 'Audio enviado';
    case 'VIDEO':
      return 'Video enviado';
    case 'DOCUMENT':
      return 'Documento enviado';
    default:
      return '';
  }
}

export const messagingService = {
  async listConversations(
    tenantId: string,
    filters?: {
      page?: number;
      limit?: number;
      status?: ConversationStatus;
      branchId?: string | null;
    },
  ): Promise<{
    data: Conversation[];
    meta: ListConversationsApiResponse['meta'];
  }> {
    const page = filters?.page ?? 1;
    const limit = filters?.limit ?? 50;

    const response = await apiClient.get<
      ListConversationsApiResponse | ListConversationsApiResponse['data']
    >(`/tenants/${tenantId}/conversations`, {
      page,
      limit,
      status: filters?.status,
      branchId: filters?.branchId ?? undefined,
    });

    const envelope = Array.isArray(response)
      ? {
          data: response,
          meta: {
            total: response.length,
            page,
            limit,
            totalPages: Math.max(1, Math.ceil(response.length / Math.max(limit, 1))),
          },
        }
      : response;

    const rows = envelope.data ?? [];
    const meta =
      envelope.meta ?? {
        total: rows.length,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(rows.length / Math.max(limit, 1))),
      };

    return {
      data: rows.map((conversation) => ({
        id: conversation.id,
        contactId: conversation.contactId,
        contactName: conversation.contactName,
        contactPhone: conversation.contactPhone,
        status: conversation.status,
        assignedTo: conversation.assignedToName,
        assignedToUserId: conversation.assignedToUserId,
        assignedToName: conversation.assignedToName,
        assignedAt: conversation.assignedAt,
        unreadCount: conversation.unreadCount,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        lastInboundAt: conversation.lastInboundAt,
        lastOutboundAt: conversation.lastOutboundAt,
        lastMessageSequence: conversation.lastMessageSequence,
        lastMessage: conversation.lastMessage?.content,
        lastMessageDirection: conversation.lastMessage?.direction,
        lastMessageAt: conversation.lastMessage?.timestamp,
        intelligence: conversation.intelligence,
        channel: conversation.channel,
      })),
      meta,
    };
  },

  async getMessages(
    tenantId: string,
    conversationId: string,
  ): Promise<{
    data: Message[];
    meta: GetConversationMessagesApiResponse['meta'];
  }> {
    const response = await apiClient.get<GetConversationMessagesApiResponse>(
      `/tenants/${tenantId}/conversations/${conversationId}/messages`,
      {
        page: 1,
        limit: 100,
      },
    );

    return {
      data: response.data.map((message) => ({
          id: message.id,
          conversationId,
          direction: message.direction,
          sender: mapSender(message.sentBy),
          content:
            message.content?.text ||
            getMediaLabel(message.contentType) ||
            '',
          status: message.deliveryStatus,
          timestamp: message.timestamp,
          mediaUrl: message.content?.url,
          mediaType: message.contentType,
        })),
      meta: response.meta,
    };
  },

  async sendMessage(
    tenantId: string,
    conversationId: string,
    text: string,
  ): Promise<{ id: string; status: string }> {
    return apiClient.post(`/tenants/${tenantId}/conversations/${conversationId}/messages`, {
      content: {
        type: 'TEXT',
        text,
      },
    });
  },

  async uploadMessage(
    tenantId: string,
    conversationId: string,
    file: File,
    text?: string,
  ): Promise<{ id: string; status: string; fileUrl: string; type: string }> {
    const formData = new FormData();
    formData.append('file', file);
    if (text?.trim()) {
      formData.append('text', text.trim());
    }

    return apiClient.post(
      `/tenants/${tenantId}/conversations/${conversationId}/messages/upload`,
      formData,
    );
  },

  async updateConversationStatus(
    tenantId: string,
    conversationId: string,
    status: 'ACTIVE' | 'PENDING_HUMAN' | 'ARCHIVED',
  ): Promise<{ id: string; status: string }> {
    return apiClient.patch(
      `/tenants/${tenantId}/conversations/${conversationId}/status`,
      {
        status,
      },
    );
  },

  async suggestReply(
    tenantId: string,
    conversationId: string,
  ): Promise<{ text: string }> {
    return apiClient.post(`/tenants/${tenantId}/conversations/${conversationId}/suggest-reply`, {});
  },

  async markConversationRead(
    tenantId: string,
    conversationId: string,
  ): Promise<{ success: true }> {
    return apiClient.post(`/tenants/${tenantId}/conversations/${conversationId}/read`, {});
  },

  async getSaleAttribution(
    tenantId: string,
    conversationId: string,
  ): Promise<{ sale: ConversationSaleAttribution | null }> {
    return apiClient.get(`/tenants/${tenantId}/conversations/${conversationId}/sale-attribution`);
  },

  async markSaleAttribution(
    tenantId: string,
    conversationId: string,
    payload: {
      attributedUserId?: string;
      saleAmount?: number;
      currency?: string;
      notes?: string;
    },
  ): Promise<ConversationSaleAttribution> {
    return apiClient.post(
      `/tenants/${tenantId}/conversations/${conversationId}/sale-attribution`,
      payload,
    );
  },

  async voidSaleAttribution(
    tenantId: string,
    conversationId: string,
  ): Promise<{ id: string; lifecycleStatus: string }> {
    return apiClient.delete(`/tenants/${tenantId}/conversations/${conversationId}/sale-attribution`);
  },
};
