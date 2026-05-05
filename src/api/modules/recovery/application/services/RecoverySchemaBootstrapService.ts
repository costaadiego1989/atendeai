import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';

@Injectable()
export class RecoverySchemaBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(RecoverySchemaBootstrapService.name);

  constructor(private readonly prisma: PrismaService) { }

  async onModuleInit(): Promise<void> {
    try {
      await this.prisma.$executeRaw(Prisma.sql`CREATE SCHEMA IF NOT EXISTS recovery_schema`);
      await this.prisma.$executeRaw(Prisma.sql`
        ALTER TABLE recovery_schema.recovery_cases
        ADD COLUMN IF NOT EXISTS branch_id UUID
      `).catch(() => this.logger.warn('Table recovery_schema.recovery_cases not ready for alter yet.'));
      await this.prisma.$executeRaw(Prisma.sql`
        CREATE INDEX IF NOT EXISTS idx_recovery_cases_tenant_branch
        ON recovery_schema.recovery_cases (tenant_id, branch_id)
      `).catch(() => { });
      await this.prisma.$executeRaw(Prisma.sql`
        CREATE TABLE IF NOT EXISTS recovery_schema.recovery_recurring_charges (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID NOT NULL,
          branch_id UUID NULL,
          case_id UUID NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
          billing_type VARCHAR(20) NOT NULL DEFAULT 'UNDEFINED',
          interval_days INTEGER NOT NULL,
          max_occurrences INTEGER NULL,
          occurrences_sent INTEGER NOT NULL DEFAULT 0,
          first_run_at TIMESTAMPTZ NOT NULL,
          next_run_at TIMESTAMPTZ NULL,
          last_run_at TIMESTAMPTZ NULL,
          message_template TEXT NULL,
          last_error TEXT NULL,
          lease_until TIMESTAMPTZ NULL,
          created_by_user_id UUID NULL,
          created_by_user_email VARCHAR(255) NULL,
          cancelled_at TIMESTAMPTZ NULL,
          completed_at TIMESTAMPTZ NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await this.prisma.$executeRaw(Prisma.sql`
        CREATE TABLE IF NOT EXISTS recovery_schema.recovery_recurring_charge_runs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          recurrence_id UUID NOT NULL,
          tenant_id UUID NOT NULL,
          case_id UUID NOT NULL,
          occurrence_number INTEGER NOT NULL,
          scheduled_for TIMESTAMPTZ NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'PROCESSING',
          payment_link_id VARCHAR(120) NULL,
          conversation_id UUID NULL,
          message_id UUID NULL,
          error_message TEXT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          completed_at TIMESTAMPTZ NULL,
          UNIQUE (recurrence_id, occurrence_number)
        )
      `);
      await this.prisma.$executeRaw(Prisma.sql`
        CREATE INDEX IF NOT EXISTS idx_recovery_recurring_charges_due
        ON recovery_schema.recovery_recurring_charges (status, next_run_at, lease_until)
      `);
      await this.prisma.$executeRaw(Prisma.sql`
        CREATE INDEX IF NOT EXISTS idx_recovery_recurring_charges_case
        ON recovery_schema.recovery_recurring_charges (tenant_id, case_id)
      `);

      await this.prisma.$executeRaw(Prisma.sql`
        CREATE TABLE IF NOT EXISTS recovery_schema.recovery_playbooks (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID NOT NULL,
          branch_id UUID NULL,
          name VARCHAR(160) NOT NULL,
          version INTEGER NOT NULL DEFAULT 1,
          active BOOLEAN NOT NULL DEFAULT false,
          is_system BOOLEAN NOT NULL DEFAULT false,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await this.prisma.$executeRaw(Prisma.sql`
        CREATE INDEX IF NOT EXISTS idx_recovery_playbooks_tenant_active
        ON recovery_schema.recovery_playbooks (tenant_id, active)
      `);

      await this.prisma.$executeRaw(Prisma.sql`
        CREATE TABLE IF NOT EXISTS recovery_schema.recovery_playbook_phases (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          playbook_id UUID NOT NULL REFERENCES recovery_schema.recovery_playbooks(id) ON DELETE CASCADE,
          sort_order INTEGER NOT NULL,
          channel VARCHAR(20) NOT NULL DEFAULT 'WHATSAPP',
          min_delay_hours_since_previous INTEGER NOT NULL DEFAULT 0,
          min_days_overdue INTEGER NOT NULL DEFAULT 0,
          mode VARCHAR(20) NOT NULL,
          template_body TEXT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (playbook_id, sort_order)
        )
      `);

      await this.prisma.$executeRaw(Prisma.sql`
        CREATE TABLE IF NOT EXISTS recovery_schema.recovery_playbook_phase_dispatch (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID NOT NULL,
          case_id UUID NOT NULL,
          phase_id UUID NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (case_id, phase_id)
        )
      `);

      await this.prisma.$executeRaw(Prisma.sql`
        ALTER TABLE recovery_schema.recovery_cases
        ADD COLUMN IF NOT EXISTS playbook_id UUID NULL
      `).catch(() => { });
      await this.prisma.$executeRaw(Prisma.sql`
        ALTER TABLE recovery_schema.recovery_cases
        ADD COLUMN IF NOT EXISTS playbook_phase_index INTEGER NOT NULL DEFAULT 0
      `).catch(() => { });
      await this.prisma.$executeRaw(Prisma.sql`
        ALTER TABLE recovery_schema.recovery_cases
        ADD COLUMN IF NOT EXISTS last_playbook_phase_executed_at TIMESTAMPTZ NULL
      `).catch(() => { });
    } catch (error) {
      this.logger.error('Failure during recovery schema bootstrap', error);
    }
  }
}
