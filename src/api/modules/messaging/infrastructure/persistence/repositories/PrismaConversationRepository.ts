import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { IConversationRepository } from '@modules/messaging/domain/repositories/IConversationRepository';
import { Conversation } from '@modules/messaging/domain/entities/Conversation';
import { Message } from '@modules/messaging/domain/entities/Message';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { MessagingMapper } from '../mappers/MessagingMapper';

@Injectable()
export class PrismaConversationRepository implements IConversationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(
    conversation: Conversation,
    options?: { tx?: Prisma.TransactionClient },
  ): Promise<void> {
    const data = MessagingMapper.toPersistence(conversation);
    const { messages, branchId, ...conversationData } = data;

    const queueState = (() => {
      const allMessages = [...conversation.messages].sort(
        (left, right) => left.createdAt.getTime() - right.createdAt.getTime(),
      );
      const lastMessage = allMessages[allMessages.length - 1];
      const lastInbound = [...allMessages]
        .reverse()
        .find((message) => message.direction === 'INBOUND');
      const lastOutbound = [...allMessages]
        .reverse()
        .find((message) => message.direction === 'OUTBOUND');
      const unreadCount = allMessages.filter(
        (message) =>
          message.direction === 'INBOUND' &&
          (!lastOutbound || message.createdAt > lastOutbound.createdAt),
      ).length;

      return {
        unreadCount,
        lastInboundAt: lastInbound?.createdAt ?? null,
        lastOutboundAt: lastOutbound?.createdAt ?? null,
        lastMessageAt: lastMessage?.createdAt ?? null,
        lastMessageDirection: lastMessage?.direction ?? null,
        lastMessagePreview: lastMessage?.content.text ?? null,
      };
    })();

    const persistConversation = async (tx: Prisma.TransactionClient) => {
      await tx.conversation.upsert({
        where: { id: conversationData.id },
        create: conversationData,
        update: conversationData,
      });

      if (branchId !== undefined) {
        await tx.$executeRaw(Prisma.sql`
            UPDATE messaging_schema.conversations
            SET branch_id = ${branchId || null}::uuid
            WHERE id = ${conversationData.id}::uuid
          `);
      }

      for (const msg of messages) {
        await tx.message.upsert({
          where: { id: msg.id },
          create: msg as unknown as Prisma.MessageCreateInput,
          update: msg as unknown as Prisma.MessageUpdateInput,
        });
      }

      await tx.$executeRaw(Prisma.sql`
          UPDATE messaging_schema.conversations
          SET
            unread_count = ${queueState.unreadCount},
            last_inbound_at = ${queueState.lastInboundAt},
            last_outbound_at = ${queueState.lastOutboundAt},
            last_message_at = ${queueState.lastMessageAt},
            last_message_direction = ${queueState.lastMessageDirection},
            last_message_preview = ${queueState.lastMessagePreview}
          WHERE id = ${conversationData.id}::uuid
        `);
    };

    if (options?.tx) {
      await persistConversation(options.tx);
      return;
    }

    await this.prisma.$transaction(persistConversation);
  }

  async findById(id: string, tenantId: string): Promise<Conversation | null> {
    const raw = await this.prisma.conversation.findFirst({
      where: { id, tenantId },
      include: {
        messages: {
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        },
      },
    });
    return raw ? MessagingMapper.toDomain(raw) : null;
  }

  async findByMessageId(
    messageId: string,
    tenantId: string,
  ): Promise<Conversation | null> {
    const raw = await this.prisma.conversation.findFirst({
      where: {
        tenantId,
        messages: {
          some: { id: messageId },
        },
      },
      include: {
        messages: {
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        },
      },
    });
    return raw ? MessagingMapper.toDomain(raw) : null;
  }

  async findByExternalMessageId(
    externalMessageId: string,
    tenantId: string,
    options?: { tx?: Prisma.TransactionClient },
  ): Promise<Conversation | null> {
    const client = options?.tx ?? this.prisma;
    const raw = await client.conversation.findFirst({
      where: {
        tenantId,
        messages: {
          some: { externalId: externalMessageId },
        },
      },
      include: {
        messages: {
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        },
      },
    });
    return raw ? MessagingMapper.toDomain(raw) : null;
  }

  async findActiveByContact(
    tenantId: string,
    contactId: string,
  ): Promise<Conversation | null> {
    const raw = await this.prisma.conversation.findFirst({
      where: { tenantId, contactId, status: 'ACTIVE' },
      include: {
        messages: {
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        },
      },
    });
    return raw ? MessagingMapper.toDomain(raw) : null;
  }

  async findLatestByContact(
    tenantId: string,
    contactId: string,
  ): Promise<Conversation | null> {
    const raw = await this.prisma.conversation.findFirst({
      where: { tenantId, contactId },
      include: {
        messages: {
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        },
      },
      orderBy: [{ updatedAt: 'desc' }, { startedAt: 'desc' }],
    });
    return raw ? MessagingMapper.toDomain(raw) : null;
  }

  async findAllByTenant(
    tenantId: string,
    filters: {
      page?: number;
      limit?: number;
      status?: string;
      branchId?: string;
      assignedUserId?: string;
    },
  ): Promise<{ data: Conversation[]; total: number }> {
    const { page = 1, limit = 20, status, branchId, assignedUserId } = filters;
    const offset = (page - 1) * limit;

    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT c.id
        FROM messaging_schema.conversations c
        WHERE c.tenant_id = ${tenantId}::uuid
          AND (${status || null}::varchar IS NULL OR c.status = ${status || null}::varchar)
          AND (
            ${branchId || null}::uuid IS NULL
            OR c.branch_id = ${branchId || null}::uuid
          )
          AND (
            ${assignedUserId || null}::uuid IS NULL
            OR c.assigned_user_id = ${assignedUserId || null}::uuid
          )
        ORDER BY c.updated_at DESC, c.started_at DESC, c.id DESC
        OFFSET ${offset}
        LIMIT ${limit}
      `);

    const totalRows = await this.prisma.$queryRaw<
      Array<{ total: bigint | number }>
    >(Prisma.sql`
        SELECT COUNT(*) AS total
        FROM messaging_schema.conversations c
        WHERE c.tenant_id = ${tenantId}::uuid
          AND (${status || null}::varchar IS NULL OR c.status = ${status || null}::varchar)
          AND (
            ${branchId || null}::uuid IS NULL
            OR c.branch_id = ${branchId || null}::uuid
          )
          AND (
            ${assignedUserId || null}::uuid IS NULL
            OR c.assigned_user_id = ${assignedUserId || null}::uuid
          )
      `);

    const orderedIds = rows.map((row) => row.id);
    const results =
      orderedIds.length > 0
        ? await this.prisma.conversation.findMany({
            where: { id: { in: orderedIds } },
            include: {
              messages: {
                orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
              },
            },
          })
        : [];

    const resultsById = new Map(
      results.map((conversation) => [conversation.id, conversation]),
    );
    const orderedResults = orderedIds
      .map((id) => resultsById.get(id))
      .filter((conversation): conversation is (typeof results)[number] =>
        Boolean(conversation),
      );

    return {
      data: orderedResults.map(MessagingMapper.toDomain),
      total: Number(totalRows[0]?.total ?? 0),
    };
  }

  async setAssignedUser(
    tenantId: string,
    conversationId: string,
    userId: string | null,
  ): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`
        UPDATE messaging_schema.conversations
        SET
          assigned_user_id = ${userId || null}::uuid,
          assigned_at = CASE
            WHEN ${userId || null}::uuid IS NULL THEN NULL
            ELSE NOW()
          END,
          released_at = CASE
            WHEN ${userId || null}::uuid IS NULL THEN NOW()
            ELSE NULL
          END
        WHERE tenant_id = ${tenantId}::uuid
          AND id = ${conversationId}::uuid
      `);
  }

  async findAssignedUsers(
    tenantId: string,
    conversationIds: string[],
  ): Promise<Record<string, { id: string; name: string; assignedAt?: Date }>> {
    if (!conversationIds.length) {
      return {};
    }

    const rows = await this.prisma.$queryRaw<
      Array<{
        conversationId: string;
        userId: string;
        userName: string;
        assignedAt: Date | null;
      }>
    >(Prisma.sql`
        SELECT
          c.id AS "conversationId",
          u.id AS "userId",
          u.name AS "userName",
          c.assigned_at AS "assignedAt"
        FROM messaging_schema.conversations c
        INNER JOIN tenant_schema.users u
          ON u.id = c.assigned_user_id
        WHERE c.tenant_id = ${tenantId}::uuid
          AND c.id IN (${Prisma.join(conversationIds.map((id) => Prisma.sql`${id}::uuid`))})
      `);

    return rows.reduce<
      Record<string, { id: string; name: string; assignedAt?: Date }>
    >((acc, row) => {
      acc[row.conversationId] = {
        id: row.userId,
        name: row.userName,
        assignedAt: row.assignedAt ?? undefined,
      };
      return acc;
    }, {});
  }

  async findQueueState(
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
  > {
    if (!conversationIds.length) {
      return {};
    }

    const rows = await this.prisma.$queryRaw<
      Array<{
        conversationId: string;
        unreadCount: number;
        lastInboundAt: Date | null;
        lastOutboundAt: Date | null;
        lastMessageAt: Date | null;
        lastMessageSequence: bigint | number | null;
        lastMessageDirection: string | null;
        lastMessagePreview: string | null;
      }>
    >(Prisma.sql`
        SELECT
          c.id AS "conversationId",
          COALESCE((
            SELECT COUNT(*)
            FROM messaging_schema.messages inbound
            WHERE inbound.conversation_id = c.id
              AND inbound.direction = 'INBOUND'
              AND inbound.sort_order > COALESCE(
                GREATEST(
                  (
                    SELECT outbound.sort_order
                    FROM messaging_schema.messages outbound
                    WHERE outbound.conversation_id = c.id
                      AND outbound.direction = 'OUTBOUND'
                    ORDER BY outbound.sort_order DESC NULLS LAST, outbound.created_at DESC, outbound.id DESC
                    LIMIT 1
                  ),
                  c.last_read_sort_order
                ),
                (
                  SELECT outbound.sort_order
                  FROM messaging_schema.messages outbound
                  WHERE outbound.conversation_id = c.id
                    AND outbound.direction = 'OUTBOUND'
                  ORDER BY outbound.sort_order DESC NULLS LAST, outbound.created_at DESC, outbound.id DESC
                  LIMIT 1
                ),
                c.last_read_sort_order,
                0
              )
          ), 0) AS "unreadCount",
          (
            SELECT inbound.created_at
            FROM messaging_schema.messages inbound
            WHERE inbound.conversation_id = c.id
              AND inbound.direction = 'INBOUND'
            ORDER BY inbound.sort_order DESC NULLS LAST, inbound.created_at DESC, inbound.id DESC
            LIMIT 1
          ) AS "lastInboundAt",
          (
            SELECT outbound.created_at
            FROM messaging_schema.messages outbound
            WHERE outbound.conversation_id = c.id
              AND outbound.direction = 'OUTBOUND'
            ORDER BY outbound.sort_order DESC NULLS LAST, outbound.created_at DESC, outbound.id DESC
            LIMIT 1
          ) AS "lastOutboundAt",
          (
            SELECT latest.created_at
            FROM messaging_schema.messages latest
            WHERE latest.conversation_id = c.id
            ORDER BY latest.sort_order DESC NULLS LAST, latest.created_at DESC, latest.id DESC
            LIMIT 1
          ) AS "lastMessageAt",
          (
            SELECT latest.sort_order
            FROM messaging_schema.messages latest
            WHERE latest.conversation_id = c.id
            ORDER BY latest.sort_order DESC NULLS LAST, latest.created_at DESC, latest.id DESC
            LIMIT 1
          ) AS "lastMessageSequence",
          (
            SELECT latest.direction
            FROM messaging_schema.messages latest
            WHERE latest.conversation_id = c.id
            ORDER BY latest.sort_order DESC NULLS LAST, latest.created_at DESC, latest.id DESC
            LIMIT 1
          ) AS "lastMessageDirection",
          (
            SELECT COALESCE(latest.content ->> 'text', '')
            FROM messaging_schema.messages latest
            WHERE latest.conversation_id = c.id
            ORDER BY latest.sort_order DESC NULLS LAST, latest.created_at DESC, latest.id DESC
            LIMIT 1
          ) AS "lastMessagePreview"
        FROM messaging_schema.conversations c
        WHERE c.tenant_id = ${tenantId}::uuid
          AND c.id IN (${Prisma.join(conversationIds.map((id) => Prisma.sql`${id}::uuid`))})
      `);

    return rows.reduce<
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
    >((acc, row) => {
      acc[row.conversationId] = {
        unreadCount: Number(row.unreadCount ?? 0),
        lastInboundAt: row.lastInboundAt ?? undefined,
        lastOutboundAt: row.lastOutboundAt ?? undefined,
        lastMessageAt: row.lastMessageAt ?? undefined,
        lastMessageSequence:
          row.lastMessageSequence !== null &&
          row.lastMessageSequence !== undefined
            ? Number(row.lastMessageSequence)
            : undefined,
        lastMessageDirection: row.lastMessageDirection ?? undefined,
        lastMessagePreview: row.lastMessagePreview ?? undefined,
      };
      return acc;
    }, {});
  }

  async markAsRead(tenantId: string, conversationId: string): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`
        UPDATE messaging_schema.conversations
        SET
          last_read_at = NOW(),
          last_read_sort_order = COALESCE((
            SELECT latest.sort_order
            FROM messaging_schema.messages latest
            WHERE latest.conversation_id = messaging_schema.conversations.id
            ORDER BY latest.sort_order DESC NULLS LAST, latest.created_at DESC, latest.id DESC
            LIMIT 1
          ), last_read_sort_order),
          unread_count = 0
        WHERE tenant_id = ${tenantId}::uuid
          AND id = ${conversationId}::uuid
      `);
  }

  async findMessagesByConversation(
    tenantId: string,
    conversationId: string,
    page: number,
    limit: number,
  ): Promise<{ data: Message[]; total: number }> {
    const [results, total] = await Promise.all([
      this.prisma.$queryRaw<
        Array<{
          id: string;
          conversationId: string;
          direction: string;
          contentType: string;
          content: Prisma.JsonValue;
          sentBy: string;
          deliveryStatus: string;
          externalId: string | null;
          createdAt: Date;
        }>
      >(Prisma.sql`
          SELECT
            m.id,
            m.conversation_id AS "conversationId",
            m.direction,
            m.content_type AS "contentType",
            m.content,
            m.sent_by AS "sentBy",
            m.delivery_status AS "deliveryStatus",
            m.external_id AS "externalId",
            m.inserted_at AS "createdAt"
          FROM messaging_schema.messages m
          INNER JOIN messaging_schema.conversations c
            ON c.id = m.conversation_id
          WHERE m.conversation_id = ${conversationId}::uuid
            AND c.tenant_id = ${tenantId}::uuid
          ORDER BY m.sort_order ASC NULLS LAST, m.inserted_at ASC
          OFFSET ${(page - 1) * limit}
          LIMIT ${limit}
        `),
      this.prisma.message.count({
        where: {
          conversationId,
          conversation: { tenantId },
        },
      }),
    ]);

    return {
      data: results.map((message) =>
        MessagingMapper.toMessageDomain(message as any),
      ),
      total,
    };
  }
}
