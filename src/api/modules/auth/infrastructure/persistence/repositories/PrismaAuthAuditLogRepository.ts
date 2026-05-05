import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import {
  AuthAuditLogInput,
  IAuthAuditLogRepository,
} from '@modules/auth/application/ports/IAuthAuditLogRepository';

@Injectable()
export class PrismaAuthAuditLogRepository implements IAuthAuditLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: AuthAuditLogInput): Promise<void> {
    await this.ensureTableShape();

    await this.prisma.$executeRaw(Prisma.sql`
        INSERT INTO shared_schema.auth_audit_logs (
          user_id,
          tenant_id,
          email,
          event_type,
          ip_address,
          user_agent,
          device_id,
          session_id,
          metadata
        ) VALUES (
          ${input.userId ?? null}::uuid,
          ${input.tenantId ?? null}::uuid,
          ${input.email ?? null},
          ${input.eventType},
          ${input.ipAddress ?? null},
          ${input.userAgent ?? null},
          ${input.deviceId ?? null},
          ${input.sessionId ?? null},
          ${JSON.stringify(input.metadata ?? {})}::jsonb
        )
      `);
  }

  private async ensureTableShape(): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`
      CREATE TABLE IF NOT EXISTS shared_schema.auth_audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NULL,
        tenant_id UUID NULL,
        email VARCHAR(255) NULL,
        event_type VARCHAR(80) NOT NULL,
        ip_address VARCHAR(255) NULL,
        user_agent TEXT NULL,
        device_id VARCHAR(255) NULL,
        session_id VARCHAR(255) NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await this.prisma.$executeRaw(Prisma.sql`
      ALTER TABLE shared_schema.auth_audit_logs
      ADD COLUMN IF NOT EXISTS device_id VARCHAR(255)
    `);
    await this.prisma.$executeRaw(Prisma.sql`
      CREATE INDEX IF NOT EXISTS idx_auth_audit_logs_user_created
      ON shared_schema.auth_audit_logs(user_id, created_at DESC)
    `);
    await this.prisma.$executeRaw(Prisma.sql`
      CREATE INDEX IF NOT EXISTS idx_auth_audit_logs_tenant_created
      ON shared_schema.auth_audit_logs(tenant_id, created_at DESC)
    `);
    await this.prisma.$executeRaw(Prisma.sql`
      CREATE INDEX IF NOT EXISTS idx_auth_audit_logs_event_created
      ON shared_schema.auth_audit_logs(event_type, created_at DESC)
    `);
  }
}
