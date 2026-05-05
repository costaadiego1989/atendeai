import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { AgentModule } from '../../../domain/enums/AgentModule';
import {
  ITenantAgentRuleRepository,
  TenantAgentRule,
  TenantAgentRuleHistory,
} from '../../../domain/repositories/ITenantAgentRuleRepository';

type AgentRuleRow = {
  tenantId: string;
  branchId: string | null;
  moduleId: string;
  customPrompt: string;
  isActive: boolean;
  fallbackToGlobal: boolean;
  revision: number;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  updatedByUserId: string | null;
  updatedByUserName: string | null;
};

type AgentRuleHistoryRow = {
  tenantId: string;
  branchId: string | null;
  moduleId: string;
  customPrompt: string;
  revision: number;
  createdAt: Date;
  updatedByUserId: string | null;
  updatedByUserName: string | null;
};

@Injectable()
export class PrismaTenantAgentRuleRepository implements ITenantAgentRuleRepository {
  private infrastructureReady: Promise<void> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async findByModule(
    tenantId: string,
    moduleId: AgentModule,
    branchId?: string | null,
  ): Promise<TenantAgentRule | null> {
    await this.ensureInfrastructure();

    if (branchId) {
      const branchRule = await this.findExactByScope(tenantId, moduleId, branchId);
      if (branchRule) {
        return {
          ...branchRule,
          inheritedFromTenant: false,
        };
      }
    }

    const tenantRule = await this.findExactByScope(tenantId, moduleId, null);
    if (!tenantRule) {
      return null;
    }

    return {
      ...tenantRule,
      inheritedFromTenant: Boolean(branchId),
    };
  }

  async findExactByScope(
    tenantId: string,
    moduleId: AgentModule,
    branchId?: string | null,
  ): Promise<TenantAgentRule | null> {
    await this.ensureInfrastructure();

    const rows = branchId
      ? await this.prisma.$queryRaw<AgentRuleRow[]>(Prisma.sql`
            SELECT
              tenant_id AS "tenantId",
              branch_id AS "branchId",
              module_id AS "moduleId",
              custom_prompt AS "customPrompt",
              is_active AS "isActive",
              fallback_to_global AS "fallbackToGlobal",
              revision,
              notes,
              created_at AS "createdAt",
              updated_at AS "updatedAt",
              updated_by_user_id AS "updatedByUserId",
              updated_by_user_name AS "updatedByUserName"
            FROM tenant_schema.tenant_agent_rules
            WHERE tenant_id = ${tenantId}::uuid
              AND module_id = ${moduleId}
              AND branch_id = ${branchId}::uuid
            LIMIT 1
          `)
      : await this.prisma.$queryRaw<AgentRuleRow[]>(Prisma.sql`
            SELECT
              tenant_id AS "tenantId",
              branch_id AS "branchId",
              module_id AS "moduleId",
              custom_prompt AS "customPrompt",
              is_active AS "isActive",
              fallback_to_global AS "fallbackToGlobal",
              revision,
              notes,
              created_at AS "createdAt",
              updated_at AS "updatedAt",
              updated_by_user_id AS "updatedByUserId",
              updated_by_user_name AS "updatedByUserName"
            FROM tenant_schema.tenant_agent_rules
            WHERE tenant_id = ${tenantId}::uuid
              AND module_id = ${moduleId}
              AND branch_id IS NULL
            LIMIT 1
          `);

    const row = rows[0];
    if (!row) {
      return null;
    }

    return this.toDomain(row);
  }

  async save(rule: TenantAgentRule): Promise<void> {
    await this.ensureInfrastructure();

    if (rule.branchId) {
      const updatedRows = await this.prisma.$executeRaw(Prisma.sql`
          UPDATE tenant_schema.tenant_agent_rules
          SET
            custom_prompt = ${rule.customPrompt},
            is_active = ${rule.isActive},
            fallback_to_global = ${rule.fallbackToGlobal},
            revision = ${rule.revision},
            notes = ${rule.notes ?? null},
            updated_by_user_id = ${rule.updatedByUserId ?? null}::uuid,
            updated_by_user_name = ${rule.updatedByUserName ?? null},
            updated_at = NOW()
          WHERE tenant_id = ${rule.tenantId}::uuid
            AND module_id = ${rule.moduleId}
            AND branch_id = ${rule.branchId}::uuid
        `);

      if (updatedRows > 0) {
        return;
      }

      await this.prisma.$executeRaw(Prisma.sql`
          INSERT INTO tenant_schema.tenant_agent_rules (
            id,
            tenant_id,
            branch_id,
            module_id,
            custom_prompt,
            is_active,
            fallback_to_global,
            revision,
            notes,
            updated_by_user_id,
            updated_by_user_name
          )
          VALUES (
            gen_random_uuid(),
            ${rule.tenantId}::uuid,
            ${rule.branchId}::uuid,
            ${rule.moduleId},
            ${rule.customPrompt},
            ${rule.isActive},
            ${rule.fallbackToGlobal},
            ${rule.revision},
            ${rule.notes ?? null},
            ${rule.updatedByUserId ?? null}::uuid,
            ${rule.updatedByUserName ?? null}
          )
        `);

      return;
    }

    const updatedRows = await this.prisma.$executeRaw(Prisma.sql`
        UPDATE tenant_schema.tenant_agent_rules
        SET
          custom_prompt = ${rule.customPrompt},
          is_active = ${rule.isActive},
          fallback_to_global = ${rule.fallbackToGlobal},
          revision = ${rule.revision},
          notes = ${rule.notes ?? null},
          updated_by_user_id = ${rule.updatedByUserId ?? null}::uuid,
          updated_by_user_name = ${rule.updatedByUserName ?? null},
          updated_at = NOW()
        WHERE tenant_id = ${rule.tenantId}::uuid
          AND module_id = ${rule.moduleId}
          AND branch_id IS NULL
      `);

    if (updatedRows > 0) {
      return;
    }

    await this.prisma.$executeRaw(Prisma.sql`
        INSERT INTO tenant_schema.tenant_agent_rules (
          id,
          tenant_id,
          branch_id,
          module_id,
          custom_prompt,
          is_active,
          fallback_to_global,
          revision,
          notes,
          updated_by_user_id,
          updated_by_user_name
        )
        VALUES (
          gen_random_uuid(),
          ${rule.tenantId}::uuid,
          NULL,
          ${rule.moduleId},
          ${rule.customPrompt},
          ${rule.isActive},
          ${rule.fallbackToGlobal},
          ${rule.revision},
          ${rule.notes ?? null},
          ${rule.updatedByUserId ?? null}::uuid,
          ${rule.updatedByUserName ?? null}
        )
      `);
  }

  async saveHistory(history: TenantAgentRuleHistory): Promise<void> {
    await this.ensureInfrastructure();

    await this.prisma.$executeRaw(Prisma.sql`
        INSERT INTO tenant_schema.tenant_agent_rule_history (
          id,
          tenant_id,
          branch_id,
          module_id,
          custom_prompt,
          revision,
          created_at,
          updated_by_user_id,
          updated_by_user_name
        )
        VALUES (
          gen_random_uuid(),
          ${history.tenantId}::uuid,
          ${history.branchId ?? null}::uuid,
          ${history.moduleId},
          ${history.customPrompt},
          ${history.revision},
          ${history.createdAt}::timestamptz,
          ${history.updatedByUserId ?? null}::uuid,
          ${history.updatedByUserName ?? null}
        )
      `);
  }

  async listRecentHistory(params: {
    tenantId: string;
    moduleId: AgentModule;
    branchId?: string | null;
    limit: number;
  }): Promise<TenantAgentRuleHistory[]> {
    await this.ensureInfrastructure();

    const lim = Math.min(100, Math.max(1, params.limit));

    const rows = params.branchId
      ? await this.prisma.$queryRaw<AgentRuleHistoryRow[]>(Prisma.sql`
            SELECT
              tenant_id AS "tenantId",
              branch_id AS "branchId",
              module_id AS "moduleId",
              custom_prompt AS "customPrompt",
              revision,
              created_at AS "createdAt",
              updated_by_user_id AS "updatedByUserId",
              updated_by_user_name AS "updatedByUserName"
            FROM tenant_schema.tenant_agent_rule_history
            WHERE tenant_id = ${params.tenantId}::uuid
              AND module_id = ${params.moduleId}
              AND branch_id = ${params.branchId}::uuid
            ORDER BY created_at DESC
            LIMIT ${lim}
          `)
      : await this.prisma.$queryRaw<AgentRuleHistoryRow[]>(Prisma.sql`
            SELECT
              tenant_id AS "tenantId",
              branch_id AS "branchId",
              module_id AS "moduleId",
              custom_prompt AS "customPrompt",
              revision,
              created_at AS "createdAt",
              updated_by_user_id AS "updatedByUserId",
              updated_by_user_name AS "updatedByUserName"
            FROM tenant_schema.tenant_agent_rule_history
            WHERE tenant_id = ${params.tenantId}::uuid
              AND module_id = ${params.moduleId}
              AND branch_id IS NULL
            ORDER BY created_at DESC
            LIMIT ${lim}
          `);

    return rows.map((row) => ({
      tenantId: row.tenantId,
      branchId: row.branchId,
      moduleId: row.moduleId as AgentModule,
      customPrompt: row.customPrompt,
      revision: row.revision,
      createdAt: row.createdAt,
      updatedByUserId: row.updatedByUserId ?? undefined,
      updatedByUserName: row.updatedByUserName ?? undefined,
    }));
  }

  private async ensureInfrastructure(): Promise<void> {
    if (!this.infrastructureReady) {
      this.infrastructureReady = (async () => {
        await this.prisma.$executeRaw(Prisma.sql`
          ALTER TABLE tenant_schema.tenant_agent_rules
          ADD COLUMN IF NOT EXISTS branch_id UUID
        `);
        await this.prisma.$executeRaw(Prisma.sql`
          ALTER TABLE tenant_schema.tenant_agent_rule_history
          ADD COLUMN IF NOT EXISTS branch_id UUID
        `);
        await this.prisma.$executeRaw(Prisma.sql`
          ALTER TABLE tenant_schema.tenant_agent_rules
          DROP CONSTRAINT IF EXISTS uq_tenant_agent_rules
        `);
        await this.prisma.$executeRaw(Prisma.sql`
          ALTER TABLE tenant_schema.tenant_agent_rules
          DROP CONSTRAINT IF EXISTS tenant_agent_rules_tenant_id_module_id_key
        `);
        await this.prisma.$executeRaw(Prisma.sql`
          DROP INDEX IF EXISTS tenant_schema.uq_tenant_agent_rules
        `);
        await this.prisma.$executeRaw(Prisma.sql`
          DROP INDEX IF EXISTS tenant_schema.tenant_agent_rules_tenant_id_module_id_key
        `);
        await this.prisma.$executeRaw(Prisma.sql`
          CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_agent_rules_tenant_scope
          ON tenant_schema.tenant_agent_rules (tenant_id, module_id)
          WHERE branch_id IS NULL
        `);
        await this.prisma.$executeRaw(Prisma.sql`
          CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_agent_rules_branch_scope
          ON tenant_schema.tenant_agent_rules (tenant_id, module_id, branch_id)
          WHERE branch_id IS NOT NULL
        `);
        await this.prisma.$executeRaw(Prisma.sql`
          CREATE INDEX IF NOT EXISTS idx_tenant_agent_rules_lookup
          ON tenant_schema.tenant_agent_rules (tenant_id, module_id, branch_id)
        `);
        await this.prisma.$executeRaw(Prisma.sql`
          CREATE INDEX IF NOT EXISTS idx_tenant_agent_rule_history_lookup_v2
          ON tenant_schema.tenant_agent_rule_history (tenant_id, module_id, branch_id, created_at DESC)
        `);
      })();
    }

    await this.infrastructureReady;
  }

  private toDomain(row: AgentRuleRow): TenantAgentRule {
    return {
      tenantId: row.tenantId,
      branchId: row.branchId,
      moduleId: row.moduleId as AgentModule,
      customPrompt: row.customPrompt,
      isActive: row.isActive,
      fallbackToGlobal: row.fallbackToGlobal,
      revision: row.revision,
      notes: row.notes,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      updatedByUserId: row.updatedByUserId,
      updatedByUserName: row.updatedByUserName,
      inheritedFromTenant: false,
    };
  }
}
