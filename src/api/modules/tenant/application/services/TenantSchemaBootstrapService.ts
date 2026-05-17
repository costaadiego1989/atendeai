import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

/**
 * @deprecated All schema changes are now managed via Prisma migrations.
 * This service is kept as a no-op for DI compatibility and will be removed in a future cleanup.
 */
@Injectable()
export class TenantSchemaBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(TenantSchemaBootstrapService.name);

  async onModuleInit(): Promise<void> {
    this.logger.log(
      'Tenant schema managed by Prisma migrations. No runtime DDL needed.',
    );
  }

  async ensureSchema(): Promise<void> {
    // No-op: schema is managed by Prisma migrations
  }
}
