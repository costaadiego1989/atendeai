import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';

@Injectable()
export class SchedulingGoogleCalendarSchemaBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(SchedulingGoogleCalendarSchemaBootstrapService.name);

  constructor(private readonly prisma: PrismaService) { }

  async onModuleInit() {
    try {
      await this.prisma.$executeRaw(Prisma.sql`
        CREATE SCHEMA IF NOT EXISTS scheduling_schema;
      `);

      await this.prisma.$executeRaw(Prisma.sql`
        CREATE TABLE IF NOT EXISTS scheduling_schema.google_calendar_connection_scopes (
          scope_key VARCHAR(255) PRIMARY KEY,
          tenant_id UUID NOT NULL,
          branch_id UUID NULL,
          google_email VARCHAR(255),
          refresh_token TEXT NOT NULL,
          calendar_id VARCHAR(255) NOT NULL DEFAULT 'primary',
          status VARCHAR(40) NOT NULL,
          connected_at TIMESTAMPTZ NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL
        );
      `).catch(() => { });

      await this.prisma.$executeRaw(Prisma.sql`
        CREATE TABLE IF NOT EXISTS scheduling_schema.google_calendar_event_links (
          tenant_id UUID NOT NULL,
          branch_id UUID NULL,
          professional_id VARCHAR(64) NOT NULL,
          date DATE NOT NULL,
          slot_id VARCHAR(255) NOT NULL,
          event_id VARCHAR(255) NOT NULL,
          created_at TIMESTAMPTZ NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL,
          PRIMARY KEY (tenant_id, professional_id, date, slot_id)
        );
      `).catch(() => { });

      await this.prisma.$executeRaw(Prisma.sql`
        CREATE INDEX IF NOT EXISTS idx_scheduling_google_calendar_connection_scopes_tenant_branch
          ON scheduling_schema.google_calendar_connection_scopes (tenant_id, branch_id);
      `).catch(() => { });
    } catch (error) {
      this.logger.error('Failure during scheduling google calendar schema bootstrap', error);
    }
  }
}
