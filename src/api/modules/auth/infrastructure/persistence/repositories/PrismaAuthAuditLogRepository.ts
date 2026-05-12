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
}
