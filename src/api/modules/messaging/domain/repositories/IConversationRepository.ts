import { Prisma } from '@prisma/client';
import { Conversation } from '../entities/Conversation';
import { Message } from '../entities/Message';

export interface IConversationRepository {
  save(
    conversation: Conversation,
    options?: { tx?: Prisma.TransactionClient },
  ): Promise<void>;
  findById(id: string): Promise<Conversation | null>;
  findByMessageId(messageId: string): Promise<Conversation | null>;
  findByExternalMessageId(
    externalMessageId: string,
  ): Promise<Conversation | null>;
  findActiveByContact(
    tenantId: string,
    contactId: string,
  ): Promise<Conversation | null>;
  findLatestByContact(
    tenantId: string,
    contactId: string,
  ): Promise<Conversation | null>;
  findAllByTenant(
    tenantId: string,
    filters: {
      page?: number;
      limit?: number;
      status?: string;
      branchId?: string;
      assignedUserId?: string;
    },
  ): Promise<{ data: Conversation[]; total: number }>;
  setAssignedUser(
    tenantId: string,
    conversationId: string,
    userId: string | null,
  ): Promise<void>;
  findAssignedUsers(
    tenantId: string,
    conversationIds: string[],
  ): Promise<Record<string, { id: string; name: string; assignedAt?: Date }>>;
  findQueueState(
    tenantId: string,
    conversationIds: string[],
  ): Promise<
    Record<
      string,
      {
        unreadCount: number;
        lastInboundAt?: Date;
        lastOutboundAt?: Date;
        lastMessageAt?: Date;
        lastMessageSequence?: number;
        lastMessageDirection?: string;
        lastMessagePreview?: string;
      }
    >
  >;
  markAsRead(tenantId: string, conversationId: string): Promise<void>;
  findMessagesByConversation(
    conversationId: string,
    page: number,
    limit: number,
  ): Promise<{ data: Message[]; total: number }>;
}

export const CONVERSATION_REPOSITORY = Symbol('IConversationRepository');
