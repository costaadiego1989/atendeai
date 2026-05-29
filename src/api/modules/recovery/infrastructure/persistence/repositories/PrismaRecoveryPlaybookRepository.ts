import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import {
  CreateRecoveryPlaybookInput,
  RecoveryPlaybookPhaseRecord,
  RecoveryPlaybookRecord,
  RecoveryPlaybookWithPhases,
} from '../../../domain/types/recovery-playbook.types';
import { IRecoveryPlaybookRepository } from '../../../domain/ports/IRecoveryPlaybookRepository';
import { randomUUID } from 'crypto';

@Injectable()
export class PrismaRecoveryPlaybookRepository implements IRecoveryPlaybookRepository {
  constructor(private readonly prisma: PrismaService) {}

  async ensureSystemDefaultPlaybook(
    tenantId: string,
  ): Promise<RecoveryPlaybookWithPhases | null> {
    const rows = await this.prisma.$queryRaw<{ n: bigint }[]>(Prisma.sql`
      SELECT COUNT(*)::bigint AS n FROM recovery_schema.recovery_playbooks
      WHERE tenant_id = ${tenantId}::uuid
    `);
    const count = Number(rows[0]?.n ?? 0);
    if (count > 0) {
      return null;
    }

    const playbookId = randomUUID();
    const phase0 = randomUUID();
    const phase1 = randomUUID();

    await this.prisma.$executeRaw(Prisma.sql`
      INSERT INTO recovery_schema.recovery_playbooks (
        id, tenant_id, branch_id, name, version, active, is_system, created_at, updated_at
      ) VALUES (
        ${playbookId}::uuid,
        ${tenantId}::uuid,
        NULL,
        'Padrão sistema',
        1,
        true,
        true,
        now(),
        now()
      )
    `);

    await this.prisma.$executeRaw(Prisma.sql`
      INSERT INTO recovery_schema.recovery_playbook_phases (
        id, playbook_id, sort_order, channel, min_delay_hours_since_previous,
        min_days_overdue, mode, template_body, created_at, updated_at
      ) VALUES
      (
        ${phase0}::uuid,
        ${playbookId}::uuid,
        0,
        'WHATSAPP',
        0,
        0,
        'AI',
        NULL,
        now(),
        now()
      ),
      (
        ${phase1}::uuid,
        ${playbookId}::uuid,
        1,
        'WHATSAPP',
        72,
        3,
        'AI',
        NULL,
        now(),
        now()
      )
    `);

    return this.findPlaybookWithPhases(tenantId, playbookId);
  }

  async listPlaybooks(tenantId: string): Promise<RecoveryPlaybookRecord[]> {
    const list = await this.prisma.$queryRaw<
      Record<string, unknown>[]
    >(Prisma.sql`
      SELECT * FROM recovery_schema.recovery_playbooks
      WHERE tenant_id = ${tenantId}::uuid
      ORDER BY created_at ASC
    `);
    return list.map((r) => this.mapPlaybook(r));
  }

  async listPhases(playbookId: string): Promise<RecoveryPlaybookPhaseRecord[]> {
    const list = await this.prisma.$queryRaw<
      Record<string, unknown>[]
    >(Prisma.sql`
      SELECT * FROM recovery_schema.recovery_playbook_phases
      WHERE playbook_id = ${playbookId}::uuid
      ORDER BY sort_order ASC
    `);
    return list.map((r) => this.mapPhase(r));
  }

  async findPlaybookWithPhases(
    tenantId: string,
    playbookId: string,
  ): Promise<RecoveryPlaybookWithPhases | null> {
    const [row] = await this.prisma.$queryRaw<
      Record<string, unknown>[]
    >(Prisma.sql`
      SELECT * FROM recovery_schema.recovery_playbooks
      WHERE tenant_id = ${tenantId}::uuid AND id = ${playbookId}::uuid
      LIMIT 1
    `);
    if (!row) {
      return null;
    }
    const playbook = this.mapPlaybook(row);
    const phases = await this.listPhases(playbookId);
    return { playbook, phases };
  }

  async findActivePlaybookWithPhases(
    tenantId: string,
    branchId?: string | null,
  ): Promise<RecoveryPlaybookWithPhases | null> {
    if (branchId) {
      const [scoped] = await this.prisma.$queryRaw<
        Record<string, unknown>[]
      >(Prisma.sql`
        SELECT * FROM recovery_schema.recovery_playbooks
        WHERE tenant_id = ${tenantId}::uuid AND active = true AND branch_id = ${branchId}::uuid
        LIMIT 1
      `);
      if (scoped) {
        const pb = this.mapPlaybook(scoped);
        const phases = await this.listPhases(pb.id);
        return { playbook: pb, phases };
      }
    }

    const [fallback] = await this.prisma.$queryRaw<
      Record<string, unknown>[]
    >(Prisma.sql`
      SELECT * FROM recovery_schema.recovery_playbooks
      WHERE tenant_id = ${tenantId}::uuid AND active = true AND branch_id IS NULL
      LIMIT 1
    `);
    if (!fallback) {
      return null;
    }
    const playbook = this.mapPlaybook(fallback);
    const phases = await this.listPhases(playbook.id);
    return { playbook, phases };
  }

  async createPlaybook(
    input: CreateRecoveryPlaybookInput,
  ): Promise<RecoveryPlaybookWithPhases> {
    const playbookId = randomUUID();

    await this.prisma.$executeRaw(Prisma.sql`
      INSERT INTO recovery_schema.recovery_playbooks (
        id, tenant_id, branch_id, name, version, active, is_system, created_at, updated_at
      ) VALUES (
        ${playbookId}::uuid,
        ${input.tenantId}::uuid,
        ${input.branchId ?? null}::uuid,
        ${input.name},
        1,
        false,
        false,
        now(),
        now()
      )
    `);

    for (const phase of input.phases) {
      const phaseId = randomUUID();
      await this.prisma.$executeRaw(Prisma.sql`
        INSERT INTO recovery_schema.recovery_playbook_phases (
          id, playbook_id, sort_order, channel, min_delay_hours_since_previous,
          min_days_overdue, mode, template_body, created_at, updated_at
        ) VALUES (
          ${phaseId}::uuid,
          ${playbookId}::uuid,
          ${phase.sortOrder},
          ${phase.channel ?? 'WHATSAPP'},
          ${phase.minDelayHoursSincePrevious ?? 0},
          ${phase.minDaysOverdue ?? 0},
          ${phase.mode},
          ${phase.templateBody ?? null},
          now(),
          now()
        )
      `);
    }

    const created = await this.findPlaybookWithPhases(
      input.tenantId,
      playbookId,
    );
    if (!created) {
      throw new Error('Failed to load playbook after create');
    }
    return created;
  }

  async activatePlaybook(
    tenantId: string,
    playbookId: string,
  ): Promise<RecoveryPlaybookRecord> {
    const target = await this.findPlaybookWithPhases(tenantId, playbookId);
    if (!target) {
      throw new Error('Playbook not found');
    }

    const branchKey = target.playbook.branchId;

    if (branchKey == null) {
      await this.prisma.$executeRaw(Prisma.sql`
        UPDATE recovery_schema.recovery_playbooks
        SET active = false, updated_at = now()
        WHERE tenant_id = ${tenantId}::uuid AND branch_id IS NULL
      `);
    } else {
      await this.prisma.$executeRaw(Prisma.sql`
        UPDATE recovery_schema.recovery_playbooks
        SET active = false, updated_at = now()
        WHERE tenant_id = ${tenantId}::uuid AND branch_id = ${branchKey}::uuid
      `);
    }

    const [updated] = await this.prisma.$queryRaw<
      Record<string, unknown>[]
    >(Prisma.sql`
      UPDATE recovery_schema.recovery_playbooks
      SET active = true, updated_at = now()
      WHERE tenant_id = ${tenantId}::uuid AND id = ${playbookId}::uuid
      RETURNING *
    `);

    return this.mapPlaybook(updated);
  }

  async hasDispatchedPhase(caseId: string, phaseId: string): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<{ exists: boolean }[]>(Prisma.sql`
      SELECT EXISTS (
        SELECT 1 FROM recovery_schema.recovery_playbook_phase_dispatch
        WHERE case_id = ${caseId}::uuid AND phase_id = ${phaseId}::uuid
      ) AS exists
    `);
    return Boolean(rows[0]?.exists);
  }

  async recordPhaseDispatch(input: {
    tenantId: string;
    caseId: string;
    phaseId: string;
  }): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`
      INSERT INTO recovery_schema.recovery_playbook_phase_dispatch (
        tenant_id, case_id, phase_id, created_at
      ) VALUES (
        ${input.tenantId}::uuid,
        ${input.caseId}::uuid,
        ${input.phaseId}::uuid,
        now()
      )
      ON CONFLICT (case_id, phase_id) DO NOTHING
    `);
  }

  private mapPlaybook(row: Record<string, unknown>): RecoveryPlaybookRecord {
    return {
      id: String(row.id),
      tenantId: String(row.tenant_id),
      branchId: row.branch_id != null ? String(row.branch_id) : null,
      name: String(row.name),
      version: Number(row.version ?? 1),
      active: Boolean(row.active),
      isSystem: Boolean(row.is_system ?? false),
      createdAt: new Date(String(row.created_at)),
      updatedAt: new Date(String(row.updated_at)),
    };
  }

  private mapPhase(row: Record<string, unknown>): RecoveryPlaybookPhaseRecord {
    return {
      id: String(row.id),
      playbookId: String(row.playbook_id),
      sortOrder: Number(row.sort_order),
      channel: String(row.channel ?? 'WHATSAPP'),
      minDelayHoursSincePrevious: Number(
        row.min_delay_hours_since_previous ?? 0,
      ),
      minDaysOverdue: Number(row.min_days_overdue ?? 0),
      mode: String(row.mode) as RecoveryPlaybookPhaseRecord['mode'],
      templateBody:
        row.template_body != null ? String(row.template_body) : null,
    };
  }
}
