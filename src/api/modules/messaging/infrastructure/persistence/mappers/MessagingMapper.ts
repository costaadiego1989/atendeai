import {
  Conversation,
  ConversationStatus,
} from '@modules/messaging/domain/entities/Conversation';
import {
  Message,
  MessageDirection,
  MessageSource,
  DeliveryStatus,
} from '@modules/messaging/domain/entities/Message';
import { MessageContent } from '@modules/messaging/domain/value-objects/MessageContent';
import { TenantId } from '@shared/domain/TenantId';
import { UniqueEntityID } from '@shared/domain/UniqueEntityID';
import {
  Conversation as PrismaConversation,
  Message as PrismaMessage,
} from '@prisma/client';

export type PrismaConversationWithRelations = PrismaConversation & {
  messages?: PrismaMessage[];
};

export class MessagingMapper {
  public static toDomain(raw: PrismaConversationWithRelations): Conversation {
    const conversation = Conversation.reconstitute(
      {
        tenantId: TenantId.create(raw.tenantId),
        contactId: new UniqueEntityID(raw.contactId),
        branchId:
          ((raw as PrismaConversationWithRelations & { branchId?: string | null }).branchId ??
            (raw as PrismaConversationWithRelations & { branch_id?: string | null }).branch_id ??
            null),
        channel: raw.channel,
        status: raw.status as ConversationStatus,
        messages: [],
        startedAt: raw.startedAt,
        updatedAt: raw.updatedAt,
      },
      new UniqueEntityID(raw.id),
    );

    if (raw.messages) {
      (conversation as any).props.messages = raw.messages.map((m) =>
        MessagingMapper.toMessageDomain(m),
      );
    }

    return conversation;
  }

  public static toMessageDomain(m: PrismaMessage): Message {
    return Message.reconstitute(
      {
        conversationId: new UniqueEntityID(m.conversationId),
        direction: m.direction as MessageDirection,
        contentType: m.contentType,
        content: MessageContent.create(m.content as any),
        sentBy: m.sentBy as MessageSource,
        deliveryStatus: m.deliveryStatus as DeliveryStatus,
        externalId: m.externalId || undefined,
        createdAt: m.createdAt,
      },
      new UniqueEntityID(m.id),
    );
  }

  public static toPersistence(conversation: Conversation) {
    return {
      id: conversation.id.toString(),
      tenantId: conversation.tenantId.toString(),
      contactId: conversation.contactId.toString(),
      branchId: conversation.branchId ?? undefined,
      channel: conversation.channel,
      status: conversation.status,
      startedAt: conversation.startedAt,
      updatedAt: conversation.updatedAt,
      messages: conversation.messages.map((m) => ({
        id: m.id.toString(),
        conversationId: conversation.id.toString(),
        direction: m.direction,
        contentType: m.contentType,
        content: m.content.toPersistence(),
        sentBy: m.sentBy,
        deliveryStatus: m.deliveryStatus,
        externalId: m.externalId || null,
        createdAt: m.createdAt,
      })),
    };
  }
}
