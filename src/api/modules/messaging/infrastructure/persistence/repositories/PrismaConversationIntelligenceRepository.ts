import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import {
  ConversationIntelligenceRecord,
  IConversationIntelligenceRepository,
} from '../../../domain/repositories/IConversationIntelligenceRepository';

@Injectable()
export class PrismaConversationIntelligenceRepository implements IConversationIntelligenceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(
    record: Omit<ConversationIntelligenceRecord, 'updatedAt'>,
    options?: { tx?: Prisma.TransactionClient },
  ): Promise<void> {
    const executor = options?.tx ?? this.prisma;

    await executor.$executeRaw(Prisma.sql`
      INSERT INTO messaging_schema.conversation_intelligence (
        tenant_id,
        conversation_id,
        summary,
        sentiment,
        tags,
        interests,
        next_step,
        loss_reason,
        updated_at
      )
      VALUES (
        ${record.tenantId}::uuid,
        ${record.conversationId}::uuid,
        ${record.summary},
        ${record.sentiment},
        ${JSON.stringify(record.tags)}::jsonb,
        ${JSON.stringify(record.interests)}::jsonb,
        ${record.nextStep ?? null},
        ${record.lossReason ?? null},
        NOW()
      )
      ON CONFLICT (tenant_id, conversation_id) DO UPDATE SET
        summary = EXCLUDED.summary,
        sentiment = EXCLUDED.sentiment,
        tags = EXCLUDED.tags,
        interests = EXCLUDED.interests,
        next_step = EXCLUDED.next_step,
        loss_reason = EXCLUDED.loss_reason,
        updated_at = NOW()
    `);
  }

  async findByConversationIds(
    tenantId: string,
    conversationIds: string[],
  ): Promise<Record<string, ConversationIntelligenceRecord>> {
    if (!conversationIds.length) {
      return {};
    }

    const rows = await this.prisma.$queryRaw<
      Array<{
        tenant_id: string;
        conversation_id: string;
        summary: string;
        sentiment: ConversationIntelligenceRecord['sentiment'];
        tags: unknown;
        interests: unknown;
        next_step: string | null;
        loss_reason: string | null;
        updated_at: Date;
      }>
    >(Prisma.sql`
      SELECT
        tenant_id,
        conversation_id,
        summary,
        sentiment,
        tags,
        interests,
        next_step,
        loss_reason,
        updated_at
      FROM messaging_schema.conversation_intelligence
      WHERE tenant_id = ${tenantId}::uuid
        AND conversation_id IN (${Prisma.join(
          conversationIds.map((id) => Prisma.sql`${id}::uuid`),
        )})
    `);

    return rows.reduce<Record<string, ConversationIntelligenceRecord>>(
      (acc, row) => {
        acc[row.conversation_id] = {
          tenantId: row.tenant_id,
          conversationId: row.conversation_id,
          summary: row.summary,
          sentiment: row.sentiment,
          tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
          interests: Array.isArray(row.interests)
            ? (row.interests as string[])
            : [],
          nextStep: row.next_step,
          lossReason: row.loss_reason,
          updatedAt: row.updated_at,
        };
        return acc;
      },
      {},
    );
  }
}
