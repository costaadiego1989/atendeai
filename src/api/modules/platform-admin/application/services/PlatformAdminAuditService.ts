import { Injectable, Logger } from '@nestjs/common';

export interface PlatformAdminAuditEntry {
  action: string;
  tenantId?: string;
  performedAt: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Writes structured audit logs to stdout via NestJS Logger.
 * No DB table — keeps platform-admin audit simple and observable.
 */
@Injectable()
export class PlatformAdminAuditService {
  private readonly logger = new Logger('PlatformAdminAudit');

  log(entry: PlatformAdminAuditEntry): void {
    this.logger.log(
      JSON.stringify({
        ...entry,
        performedAt: entry.performedAt.toISOString(),
      }),
    );
  }
}
