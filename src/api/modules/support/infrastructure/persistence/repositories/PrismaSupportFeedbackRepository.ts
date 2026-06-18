import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import {
  ISupportFeedbackRepository,
  ListAllFeedbacksFilters,
  ListAllFeedbacksResult,
  CreateReplyInput,
  SupportFeedbackReply,
} from '../../../domain/repositories/ISupportFeedbackRepository';
import {
  SupportFeedback,
  SupportFeedbackStatus,
} from '../../../domain/types/SupportFeedback';

@Injectable()
export class PrismaSupportFeedbackRepository implements ISupportFeedbackRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(feedback: SupportFeedback): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`
        INSERT INTO support_schema.feedbacks (
          id, tenant_id, branch_id, user_id, user_name, user_email, type, title, description,
          page_path, app_module, status, created_at, updated_at
        ) VALUES (
          ${feedback.id}::uuid,
          ${feedback.tenantId}::uuid,
          ${feedback.branchId ?? null}::uuid,
          ${feedback.userId}::uuid,
          ${feedback.userName},
          ${feedback.userEmail},
          ${feedback.type},
          ${feedback.title},
          ${feedback.description},
          ${feedback.pagePath ?? null},
          ${feedback.appModule ?? null},
          ${feedback.status},
          ${feedback.createdAt}::timestamptz,
          ${feedback.updatedAt}::timestamptz
        )
        ON CONFLICT (id) DO UPDATE SET
          tenant_id = EXCLUDED.tenant_id,
          branch_id = EXCLUDED.branch_id,
          user_id = EXCLUDED.user_id,
          user_name = EXCLUDED.user_name,
          user_email = EXCLUDED.user_email,
          type = EXCLUDED.type,
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          page_path = EXCLUDED.page_path,
          app_module = EXCLUDED.app_module,
          status = EXCLUDED.status,
          created_at = EXCLUDED.created_at,
          updated_at = EXCLUDED.updated_at
      `);
  }

  async findAllByTenant(
    tenantId: string,
    branchId?: string,
  ): Promise<SupportFeedback[]> {
    const rows = branchId
      ? await this.prisma.$queryRaw<any[]>(Prisma.sql`
            SELECT *
            FROM support_schema.feedbacks
            WHERE tenant_id = ${tenantId}::uuid
              AND branch_id = ${branchId}::uuid
            ORDER BY created_at DESC
          `)
      : await this.prisma.$queryRaw<any[]>(Prisma.sql`
            SELECT *
            FROM support_schema.feedbacks
            WHERE tenant_id = ${tenantId}::uuid
            ORDER BY created_at DESC
          `);

    return rows.map(this.mapRow);
  }

  async findAll(
    filters: ListAllFeedbacksFilters,
  ): Promise<ListAllFeedbacksResult> {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;

    const conditions: Prisma.Sql[] = [];
    if (filters.type) {
      conditions.push(Prisma.sql`f.type = ${filters.type}`);
    }
    if (filters.status) {
      conditions.push(Prisma.sql`f.status = ${filters.status}`);
    }
    if (filters.tenantId) {
      conditions.push(Prisma.sql`f.tenant_id = ${filters.tenantId}::uuid`);
    }

    const whereClause =
      conditions.length > 0
        ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
        : Prisma.empty;

    const [rows, countResult] = await Promise.all([
      this.prisma.$queryRaw<any[]>(Prisma.sql`
        SELECT f.*, t.company_name as tenant_name
        FROM support_schema.feedbacks f
        LEFT JOIN tenant_schema.tenants t ON t.id = f.tenant_id
        ${whereClause}
        ORDER BY f.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `),
      this.prisma.$queryRaw<[{ count: bigint }]>(Prisma.sql`
        SELECT COUNT(*)::bigint as count
        FROM support_schema.feedbacks f
        ${whereClause}
      `),
    ]);

    return {
      data: rows.map((row) => ({
        ...this.mapRow(row),
        tenantName: row.tenant_name ?? undefined,
      })),
      total: Number(countResult[0].count),
    };
  }

  async findById(feedbackId: string): Promise<SupportFeedback | null> {
    const rows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      SELECT f.*, t.company_name as tenant_name
      FROM support_schema.feedbacks f
      LEFT JOIN tenant_schema.tenants t ON t.id = f.tenant_id
      WHERE f.id = ${feedbackId}::uuid
      LIMIT 1
    `);

    if (!rows.length) return null;

    return {
      ...this.mapRow(rows[0]),
      tenantName: rows[0].tenant_name ?? undefined,
    } as SupportFeedback;
  }

  async updateStatus(
    feedbackId: string,
    status: SupportFeedbackStatus,
  ): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE support_schema.feedbacks
      SET status = ${status}, updated_at = NOW()
      WHERE id = ${feedbackId}::uuid
    `);
  }

  async updateStatusAndCreateReply(
    feedbackId: string,
    newStatus: SupportFeedbackStatus | null,
    reply: CreateReplyInput,
  ): Promise<SupportFeedbackReply> {
    return this.prisma.$transaction(async (tx) => {
      if (newStatus !== null) {
        await tx.$executeRaw(Prisma.sql`
          UPDATE support_schema.feedbacks
          SET status = ${newStatus}, updated_at = NOW()
          WHERE id = ${feedbackId}::uuid
        `);
      }

      const rows = await tx.$queryRaw<any[]>(Prisma.sql`
        INSERT INTO support_schema.feedback_replies (
          feedback_id, author_name, message, sent_via, message_id
        ) VALUES (
          ${reply.feedbackId}::uuid,
          ${reply.authorName},
          ${reply.message},
          ${reply.sentVia ?? null},
          ${reply.messageId ?? null}::uuid
        )
        RETURNING id, feedback_id, author_name, message, sent_via, message_id, created_at
      `);

      return this.mapReplyRow(rows[0]);
    });
  }

  async createReply(input: CreateReplyInput): Promise<SupportFeedbackReply> {
    const rows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      INSERT INTO support_schema.feedback_replies (
        feedback_id, author_name, message, sent_via, message_id
      ) VALUES (
        ${input.feedbackId}::uuid,
        ${input.authorName},
        ${input.message},
        ${input.sentVia ?? null},
        ${input.messageId ?? null}::uuid
      )
      RETURNING id, feedback_id, author_name, message, sent_via, message_id, created_at
    `);

    return this.mapReplyRow(rows[0]);
  }

  async listReplies(feedbackId: string): Promise<SupportFeedbackReply[]> {
    const rows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      SELECT *
      FROM support_schema.feedback_replies
      WHERE feedback_id = ${feedbackId}::uuid
      ORDER BY created_at ASC
    `);

    return rows.map(this.mapReplyRow);
  }

  private mapRow(row: any): SupportFeedback {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      branchId: row.branch_id ?? undefined,
      userId: row.user_id,
      userName: row.user_name,
      userEmail: row.user_email,
      type: row.type,
      title: row.title ?? row.subject,
      description: row.description ?? row.message,
      pagePath: row.page_path ?? undefined,
      appModule: row.app_module ?? undefined,
      status: row.status,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    };
  }

  private mapReplyRow(row: any): SupportFeedbackReply {
    return {
      id: row.id,
      feedbackId: row.feedback_id,
      authorName: row.author_name,
      message: row.message,
      sentVia: row.sent_via ?? null,
      messageId: row.message_id ?? null,
      createdAt: new Date(row.created_at).toISOString(),
    };
  }
}
