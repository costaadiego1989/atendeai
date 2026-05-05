import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import {
  ISupportFeedbackRepository,
} from '../../../domain/repositories/ISupportFeedbackRepository';
import { SupportFeedback } from '../../../domain/types/SupportFeedback';

@Injectable()
export class PrismaSupportFeedbackRepository
  implements ISupportFeedbackRepository
{
  constructor(private readonly prisma: PrismaService) {}

  private async ensureTable(): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`
      CREATE SCHEMA IF NOT EXISTS support_schema
    `);
    await this.prisma.$executeRaw(Prisma.sql`
      CREATE TABLE IF NOT EXISTS support_schema.feedbacks (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL,
        branch_id UUID,
        user_id UUID NOT NULL,
        user_name VARCHAR(255) NOT NULL,
        user_email VARCHAR(255) NOT NULL,
        type VARCHAR(20) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        page_path VARCHAR(255),
        status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await this.prisma.$executeRaw(Prisma.sql`
      ALTER TABLE support_schema.feedbacks
      ADD COLUMN IF NOT EXISTS branch_id UUID
    `);
    await this.prisma.$executeRaw(Prisma.sql`
      CREATE INDEX IF NOT EXISTS idx_support_feedbacks_tenant_branch
      ON support_schema.feedbacks (tenant_id, branch_id)
    `);
    await this.prisma.$executeRaw(Prisma.sql`
      ALTER TABLE support_schema.feedbacks
      ADD COLUMN IF NOT EXISTS app_module VARCHAR(80)
    `);
    await this.prisma.$executeRaw(Prisma.sql`
      CREATE INDEX IF NOT EXISTS idx_support_feedbacks_app_module
      ON support_schema.feedbacks (app_module)
      WHERE app_module IS NOT NULL
    `);
  }

  async save(feedback: SupportFeedback): Promise<void> {
    await this.ensureTable();
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

  async findAllByTenant(tenantId: string, branchId?: string): Promise<SupportFeedback[]> {
    await this.ensureTable();
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

    return rows.map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      branchId: row.branch_id ?? undefined,
      userId: row.user_id,
      userName: row.user_name,
      userEmail: row.user_email,
      type: row.type,
      title: row.title,
      description: row.description,
      pagePath: row.page_path ?? undefined,
      appModule: row.app_module ?? undefined,
      status: row.status,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    }));
  }
}
