import { Injectable, OnModuleInit, Logger } from '@nestjs/common';

/**
 * @deprecated Tables are now managed by Prisma migrations.
 * Kept as no-op for DI compatibility.
 */
@Injectable()
export class SchedulingGoogleCalendarSchemaBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(SchedulingGoogleCalendarSchemaBootstrapService.name);

  async onModuleInit() {
    this.logger.log('Schema bootstrap skipped — managed by Prisma migrations');
  }
}
