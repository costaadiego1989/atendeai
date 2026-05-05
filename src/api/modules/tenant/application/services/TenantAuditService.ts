import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  ITenantAuditLogRepository,
  TENANT_AUDIT_LOG_REPOSITORY,
  TenantAuditLogInput,
} from '../ports/ITenantAuditLogRepository';

@Injectable()
export class TenantAuditService {
  private readonly logger = new Logger(TenantAuditService.name);

  constructor(
    @Inject(TENANT_AUDIT_LOG_REPOSITORY)
    private readonly tenantAuditLogRepository: ITenantAuditLogRepository,
  ) {}

  async record(input: TenantAuditLogInput): Promise<void> {
    try {
      await this.tenantAuditLogRepository.record(input);
    } catch (error) {
      this.logger.warn(
        `Failed to record tenant audit log for tenant ${input.tenantId} and event ${input.eventType}`,
      );
    }
  }
}
