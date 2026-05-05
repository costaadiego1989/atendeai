import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import {
  ITenantAuditLogRepository,
  TenantAuditLogEntry,
  TenantAuditLogInput,
} from '../../../application/ports/ITenantAuditLogRepository';

@Injectable()
export class PrismaTenantAuditLogRepository implements ITenantAuditLogRepository {
  constructor(private readonly prisma: PrismaService) { }

  async record(input: TenantAuditLogInput): Promise<void> {
    await this.ensureTableShape();

    await this.prisma.$executeRaw(Prisma.sql`
        INSERT INTO tenant_schema.tenant_audit_logs (
          tenant_id,
          user_id,
          email,
          event_type,
          metadata
        ) VALUES (
          ${input.tenantId}::uuid,
          ${input.userId ?? null}::uuid,
          ${input.email ?? null},
          ${input.eventType},
          ${JSON.stringify(input.metadata ?? {})}::jsonb
        )
      `);
  }

  async listRecent(
    tenantId: string,
    limit = 10,
  ): Promise<TenantAuditLogEntry[]> {
    await this.ensureTableShape();

    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        tenant_id: string;
        user_id: string | null;
        email: string | null;
        event_type: TenantAuditLogEntry['eventType'];
        metadata: Record<string, unknown> | null;
        created_at: Date;
      }>
    >(Prisma.sql`
        SELECT
          id,
          tenant_id,
          user_id,
          email,
          event_type,
          metadata,
          created_at
        FROM tenant_schema.tenant_audit_logs
        WHERE tenant_id = ${tenantId}::uuid
        ORDER BY created_at DESC
        LIMIT ${limit}
      `);

    return rows.map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      email: row.email,
      eventType: row.event_type,
      metadata: (row.metadata ?? {}) as Record<string, unknown>,
      createdAt: row.created_at,
    }));
  }

  private async ensureTableShape(): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`
      CREATE TABLE IF NOT EXISTS tenant_schema.tenant_audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        user_id UUID NULL,
        email VARCHAR(255) NULL,
        event_type VARCHAR(80) NOT NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await this.prisma.$executeRaw(Prisma.sql`
      CREATE INDEX IF NOT EXISTS idx_tenant_audit_logs_tenant_created
      ON tenant_schema.tenant_audit_logs(tenant_id, created_at DESC)
    `);
    await this.prisma.$executeRaw(Prisma.sql`
      CREATE INDEX IF NOT EXISTS idx_tenant_audit_logs_event_created
      ON tenant_schema.tenant_audit_logs(event_type, created_at DESC)
    `);
  }
}
