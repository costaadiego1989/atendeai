import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { IConversationRepository } from '@modules/messaging/domain/repositories/IConversationRepository';
import { Conversation } from '@modules/messaging/domain/entities/Conversation';
import { Message } from '@modules/messaging/domain/entities/Message';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { MessagingMapper } from '../mappers/MessagingMapper';

@Injectable()
export class PrismaConversationRepository implements IConversationRepository {
  private static orderingInfraPromise: Promise<void> | null = null;
  private static assignmentInfraPromise: Promise<void> | null = null;
  private static queueInfraPromise: Promise<void> | null = null;
  private static branchInfraPromise: Promise<void> | null = null;

  constructor(private readonly prisma: PrismaService) { }

  private async ensureConversationBranchInfra(): Promise<void> {
    if (!PrismaConversationRepository.branchInfraPromise) {
      PrismaConversationRepository.branchInfraPromise = (async () => {
        await this.prisma.$executeRaw(Prisma.sql`
          ALTER TABLE messaging_schema.conversations
          ADD COLUMN IF NOT EXISTS branch_id UUID
        `);

        await this.prisma.$executeRaw(Prisma.sql`
          CREATE INDEX IF NOT EXISTS idx_conversations_tenant_branch_status
          ON messaging_schema.conversations (tenant_id, branch_id, status)
        `);
      })().catch((error) => {
        PrismaConversationRepository.branchInfraPromise = null;
        throw error;
      });
    }

    await PrismaConversationRepository.branchInfraPromise;
  }

  private async ensureConversationAssignmentInfra(): Promise<void> {
    if (!PrismaConversationRepository.assignmentInfraPromise) {
      PrismaConversationRepository.assignmentInfraPromise = (async () => {
        await this.prisma.$executeRaw(Prisma.sql`
          ALTER TABLE messaging_schema.conversations
          ADD COLUMN IF NOT EXISTS assigned_user_id UUID
        `);

        await this.prisma.$executeRaw(Prisma.sql`
          ALTER TABLE messaging_schema.conversations
          ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ
        `);

        await this.prisma.$executeRaw(Prisma.sql`
          ALTER TABLE messaging_schema.conversations
          ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ
        `);

        await this.prisma.$executeRaw(Prisma.sql`
          CREATE INDEX IF NOT EXISTS idx_conversations_assigned_user
          ON messaging_schema.conversations (tenant_id, assigned_user_id)
        `);
      })().catch((error) => {
        PrismaConversationRepository.assignmentInfraPromise = null;
        throw error;
      });
    }

    await PrismaConversationRepository.assignmentInfraPromise;
  }

  private async ensureConversationQueueInfra(): Promise<void> {
    if (!PrismaConversationRepository.queueInfraPromise) {
      PrismaConversationRepository.queueInfraPromise = (async () => {
        await this.prisma.$executeRaw(Prisma.sql`
          ALTER TABLE messaging_schema.conversations
          ADD COLUMN IF NOT EXISTS unread_count INTEGER NOT NULL DEFAULT 0
        `);

        await this.prisma.$executeRaw(Prisma.sql`
          ALTER TABLE messaging_schema.conversations
          ADD COLUMN IF NOT EXISTS last_inbound_at TIMESTAMPTZ
        `);

        await this.prisma.$executeRaw(Prisma.sql`
          ALTER TABLE messaging_schema.conversations
          ADD COLUMN IF NOT EXISTS last_outbound_at TIMESTAMPTZ
        `);

        await this.prisma.$executeRaw(Prisma.sql`
          ALTER TABLE messaging_schema.conversations
          ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ
        `);

        await this.prisma.$executeRaw(Prisma.sql`
          ALTER TABLE messaging_schema.conversations
          ADD COLUMN IF NOT EXISTS last_message_direction VARCHAR(10)
        `);

        await this.prisma.$executeRaw(Prisma.sql`
          ALTER TABLE messaging_schema.conversations
          ADD COLUMN IF NOT EXISTS last_message_preview TEXT
        `);

        await this.prisma.$executeRaw(Prisma.sql`
          ALTER TABLE messaging_schema.conversations
          ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMPTZ
        `);

        await this.prisma.$executeRaw(Prisma.sql`
          ALTER TABLE messaging_schema.conversations
          ADD COLUMN IF NOT EXISTS last_read_sort_order BIGINT
        `);

        await this.prisma.$executeRaw(Prisma.sql`
          UPDATE messaging_schema.conversations c
          SET
            last_inbound_at = (
              SELECT m.created_at
              FROM messaging_schema.messages m
              WHERE m.conversation_id = c.id
                AND m.direction = 'INBOUND'
              ORDER BY m.created_at DESC, m.id DESC
              LIMIT 1
            ),
            last_outbound_at = (
              SELECT m.created_at
              FROM messaging_schema.messages m
              WHERE m.conversation_id = c.id
                AND m.direction = 'OUTBOUND'
              ORDER BY m.created_at DESC, m.id DESC
              LIMIT 1
            ),
            last_message_at = (
              SELECT m.created_at
              FROM messaging_schema.messages m
              WHERE m.conversation_id = c.id
              ORDER BY m.created_at DESC, m.id DESC
              LIMIT 1
            ),
            last_message_direction = (
              SELECT m.direction
              FROM messaging_schema.messages m
              WHERE m.conversation_id = c.id
              ORDER BY m.created_at DESC, m.id DESC
              LIMIT 1
            ),
            last_message_preview = (
              SELECT COALESCE(m.content ->> 'text', '')
              FROM messaging_schema.messages m
              WHERE m.conversation_id = c.id
              ORDER BY m.created_at DESC, m.id DESC
              LIMIT 1
            ),
            unread_count = COALESCE((
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
            ), 0)
          WHERE EXISTS (
            SELECT 1
            FROM messaging_schema.messages m
            WHERE m.conversation_id = c.id
          )
        `);
      })().catch((error) => {
        PrismaConversationRepository.queueInfraPromise = null;
        throw error;
      });
    }

    await PrismaConversationRepository.queueInfraPromise;
  }

  private async ensureMessageOrderingInfra(): Promise<void> {
    if (!PrismaConversationRepository.orderingInfraPromise) {
      PrismaConversationRepository.orderingInfraPromise = (async () => {
        await this.prisma.$executeRaw(Prisma.sql`
          CREATE SEQUENCE IF NOT EXISTS messaging_schema.messages_sort_order_seq
        `);

        await this.prisma.$executeRaw(Prisma.sql`
          ALTER TABLE messaging_schema.messages
          ADD COLUMN IF NOT EXISTS sort_order BIGINT
        `);

        await this.prisma.$executeRaw(Prisma.sql`
          ALTER TABLE messaging_schema.messages
          ALTER COLUMN sort_order SET DEFAULT nextval('messaging_schema.messages_sort_order_seq')
        `);

        await this.prisma.$executeRaw(Prisma.sql`
          WITH max_value AS (
            SELECT COALESCE(MAX(sort_order), 0) AS base
            FROM messaging_schema.messages
          ),
          ordered AS (
            SELECT
              ctid,
              ROW_NUMBER() OVER (
                ORDER BY conversation_id ASC, created_at ASC, ctid ASC
              ) AS row_number
            FROM messaging_schema.messages
            WHERE sort_order IS NULL
          )
          UPDATE messaging_schema.messages AS messages
          SET sort_order = max_value.base + ordered.row_number
          FROM ordered, max_value
          WHERE messages.ctid = ordered.ctid
        `);

        await this.prisma.$executeRaw(Prisma.sql`
          SELECT setval(
            'messaging_schema.messages_sort_order_seq',
            GREATEST(
              COALESCE(
              (SELECT MAX(sort_order) FROM messaging_schema.messages),
                1
              ),
              1
            ),
            true
          )
        `);

        await this.prisma.$executeRaw(Prisma.sql`
          CREATE INDEX IF NOT EXISTS idx_messages_conversation_sort_order
          ON messaging_schema.messages (conversation_id, sort_order)
        `);
      })().catch((error) => {
        PrismaConversationRepository.orderingInfraPromise = null;
        throw error;
      });
    }

    await PrismaConversationRepository.orderingInfraPromise;
  }

  async save(
    conversation: Conversation,
    options?: { tx?: Prisma.TransactionClient },
  ): Promise<void> {
    await this.ensureMessageOrderingInfra();
    await this.ensureConversationQueueInfra();
    await this.ensureConversationBranchInfra();

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

  async findById(id: string): Promise<Conversation | null> {
    const raw = await this.prisma.conversation.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        },
      },
    });
    return raw ? MessagingMapper.toDomain(raw) : null;
  }

  async findByMessageId(messageId: string): Promise<Conversation | null> {
    const raw = await this.prisma.conversation.findFirst({
      where: {
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
  ): Promise<Conversation | null> {
    const raw = await this.prisma.conversation.findFirst({
      where: {
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
    await this.ensureConversationBranchInfra();
    await this.ensureConversationAssignmentInfra();

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

    const totalRows = await this.prisma.$queryRaw<Array<{ total: bigint | number }>>(Prisma.sql`
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

    const resultsById = new Map(results.map((conversation) => [conversation.id, conversation]));
    const orderedResults = orderedIds
      .map((id) => resultsById.get(id))
      .filter((conversation): conversation is (typeof results)[number] => Boolean(conversation));

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
    await this.ensureConversationAssignmentInfra();

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
    await this.ensureConversationAssignmentInfra();

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
          AND c.id = ANY(${conversationIds}::uuid[])
      `);

    return rows.reduce<Record<string, { id: string; name: string; assignedAt?: Date }>>(
      (acc, row) => {
        acc[row.conversationId] = {
          id: row.userId,
          name: row.userName,
          assignedAt: row.assignedAt ?? undefined,
        };
        return acc;
      },
      {},
    );
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
    await this.ensureConversationQueueInfra();

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
          AND c.id = ANY(${conversationIds}::uuid[])
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
          row.lastMessageSequence !== null && row.lastMessageSequence !== undefined
            ? Number(row.lastMessageSequence)
            : undefined,
        lastMessageDirection: row.lastMessageDirection ?? undefined,
        lastMessagePreview: row.lastMessagePreview ?? undefined,
      };
      return acc;
    }, {});
  }

  async markAsRead(tenantId: string, conversationId: string): Promise<void> {
    await this.ensureConversationQueueInfra();

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
    conversationId: string,
    page: number,
    limit: number,
  ): Promise<{ data: Message[]; total: number }> {
    await this.ensureMessageOrderingInfra();

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
            ordered.id,
            ordered."conversationId",
            ordered.direction,
            ordered."contentType",
            ordered.content,
            ordered."sentBy",
            ordered."deliveryStatus",
            ordered."externalId",
            ordered."createdAt"
          FROM (
            SELECT
              id,
              conversation_id AS "conversationId",
              direction,
              content_type AS "contentType",
              content,
              sent_by AS "sentBy",
              delivery_status AS "deliveryStatus",
              external_id AS "externalId",
              (
                created_at +
                (
                  (ROW_NUMBER() OVER (
                    PARTITION BY created_at
                    ORDER BY sort_order ASC NULLS LAST, id ASC
                  ) - 1) * INTERVAL '1 second'
                )
              ) AS "createdAt",
              created_at AS base_created_at,
              sort_order
            FROM messaging_schema.messages
            WHERE conversation_id = ${conversationId}::uuid
          ) AS ordered
          ORDER BY ordered.sort_order ASC NULLS LAST, ordered.base_created_at ASC, ordered.id ASC
          OFFSET ${(page - 1) * limit}
          LIMIT ${limit}
        `),
      this.prisma.message.count({
        where: { conversationId },
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
