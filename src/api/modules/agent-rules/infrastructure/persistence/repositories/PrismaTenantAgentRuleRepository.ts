import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { AgentModule } from '../../../domain/enums/AgentModule';
import {
  ITenantAgentRuleRepository,
  TenantAgentRule,
  TenantAgentRuleHistory,
} from '../../../domain/repositories/ITenantAgentRuleRepository';

type RuleRecord = Prisma.TenantAgentRuleGetPayload<object>;
type HistoryRecord = Prisma.TenantAgentRuleHistoryGetPayload<object>;

@Injectable()
export class PrismaTenantAgentRuleRepository implements ITenantAgentRuleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByModule(
    tenantId: string,
    moduleId: AgentModule,
    branchId?: string | null,
  ): Promise<TenantAgentRule | null> {
    if (branchId) {
      const branchRule = await this.findExactByScope(
        tenantId,
        moduleId,
        branchId,
      );
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
    const record = await this.prisma.tenantAgentRule.findFirst({
      where: {
        tenantId,
        moduleId,
        branchId: branchId ?? null,
      },
    });

    if (!record) {
      return null;
    }

    return this.toDomain(record);
  }

  async save(rule: TenantAgentRule): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.tenantAgentRule.findFirst({
        where: {
          tenantId: rule.tenantId,
          moduleId: rule.moduleId,
          branchId: rule.branchId ?? null,
        },
        select: { id: true },
      });

      if (existing) {
        await tx.tenantAgentRule.update({
          where: { id: existing.id, tenantId: rule.tenantId },
          data: {
            customPrompt: rule.customPrompt,
            isActive: rule.isActive,
            fallbackToGlobal: rule.fallbackToGlobal,
            revision: rule.revision,
            notes: rule.notes ?? null,
            updatedByUserId: rule.updatedByUserId ?? null,
            updatedByUserName: rule.updatedByUserName ?? null,
          },
        });
        return;
      }

      await tx.tenantAgentRule.create({
        data: {
          tenantId: rule.tenantId,
          branchId: rule.branchId ?? null,
          moduleId: rule.moduleId,
          customPrompt: rule.customPrompt,
          isActive: rule.isActive,
          fallbackToGlobal: rule.fallbackToGlobal,
          revision: rule.revision,
          notes: rule.notes ?? null,
          updatedByUserId: rule.updatedByUserId ?? null,
          updatedByUserName: rule.updatedByUserName ?? null,
        },
      });
    });
  }

  async saveHistory(history: TenantAgentRuleHistory): Promise<void> {
    await this.prisma.tenantAgentRuleHistory.create({
      data: {
        tenantId: history.tenantId,
        branchId: history.branchId ?? null,
        moduleId: history.moduleId,
        customPrompt: history.customPrompt,
        revision: history.revision,
        createdAt: history.createdAt,
        updatedByUserId: history.updatedByUserId ?? null,
        updatedByUserName: history.updatedByUserName ?? null,
      },
    });
  }

  async listRecentHistory(params: {
    tenantId: string;
    moduleId: AgentModule;
    branchId?: string | null;
    limit: number;
  }): Promise<TenantAgentRuleHistory[]> {
    const limit = Math.min(100, Math.max(1, params.limit));

    const records = await this.prisma.tenantAgentRuleHistory.findMany({
      where: {
        tenantId: params.tenantId,
        moduleId: params.moduleId,
        branchId: params.branchId ?? null,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return records.map((record) => this.toHistoryDomain(record));
  }

  private toDomain(record: RuleRecord): TenantAgentRule {
    return {
      tenantId: record.tenantId,
      branchId: record.branchId,
      moduleId: record.moduleId as AgentModule,
      customPrompt: record.customPrompt,
      isActive: record.isActive,
      fallbackToGlobal: record.fallbackToGlobal,
      revision: record.revision,
      notes: record.notes,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      updatedByUserId: record.updatedByUserId,
      updatedByUserName: record.updatedByUserName,
      inheritedFromTenant: false,
    };
  }

  private toHistoryDomain(record: HistoryRecord): TenantAgentRuleHistory {
    return {
      tenantId: record.tenantId,
      branchId: record.branchId,
      moduleId: record.moduleId as AgentModule,
      customPrompt: record.customPrompt,
      revision: record.revision,
      createdAt: record.createdAt,
      updatedByUserId: record.updatedByUserId ?? undefined,
      updatedByUserName: record.updatedByUserName ?? undefined,
    };
  }
}
