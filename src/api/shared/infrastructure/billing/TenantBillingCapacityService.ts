import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/PrismaService';

type CapacityKey = 'branches' | 'whatsappNumbers' | 'users';

type CapacityMap = Record<CapacityKey, number>;

const DEFAULT_LIMITS: CapacityMap = {
  branches: 1,
  whatsappNumbers: 1,
  users: 3,
};

const CAPACITY_LABELS: Record<CapacityKey, string> = {
  branches: 'filiais ativas',
  whatsappNumbers: 'WhatsApps conectados',
  users: 'usuarios operacionais',
};

@Injectable()
export class TenantBillingCapacityService {
  constructor(private readonly prisma: PrismaService) {}

  async assertCanAdd(
    tenantId: string,
    capacity: CapacityKey,
    amount = 1,
  ): Promise<void> {
    const summary = await this.getCapacitySummary(tenantId);
    const used = summary.used[capacity];
    const limit = summary.limits[capacity];

    if (used + amount <= limit) {
      return;
    }

    if (summary.plan === 'ESSENCIAL' && capacity === 'branches') {
      throw new ConflictException(
        'Seu plano Essencial não permite filiais adicionais. Faça upgrade para o plano Profissional ou Escala para adicionar novas filiais.',
      );
    }

    throw new ConflictException(
      `Limite de ${CAPACITY_LABELS[capacity]} atingido para o plano ${summary.plan}. Limite atual: ${limit}.`,
    );
  }

  async getCapacitySummary(tenantId: string): Promise<{
    plan: string;
    used: CapacityMap;
    limits: CapacityMap;
  }> {
    const [subscription] = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      SELECT
        subscription.plan,
        COALESCE(plan_catalog.config, '{}'::jsonb) AS "planConfig"
      FROM billing_schema.subscriptions AS subscription
      LEFT JOIN billing_schema.billing_plan_catalog AS plan_catalog
        ON plan_catalog.code = subscription.plan
      WHERE subscription.tenant_id = ${tenantId}::uuid
      ORDER BY subscription.created_at DESC
      LIMIT 1
    `);

    const limits = this.readBaseLimits(subscription?.planConfig);

    if (subscription?.plan) {
      const addonRows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
        SELECT COALESCE(module.config, '{}'::jsonb) AS config
        FROM billing_schema.subscription_modules AS subscription_module
        INNER JOIN billing_schema.billing_modules AS module
          ON module.code = subscription_module.module_code
        WHERE subscription_module.tenant_id = ${tenantId}::uuid
          AND subscription_module.status = 'ACTIVE'
          AND module.active = TRUE
      `);

      for (const row of addonRows) {
        this.applyAddonCapacity(limits, row.config);
      }
    }

    const used = await this.getUsedCapacity(tenantId);

    return {
      plan: subscription?.plan ?? 'ESSENCIAL',
      used,
      limits,
    };
  }

  private readBaseLimits(config: any): CapacityMap {
    const configLimits = config?.limits ?? {};

    return {
      branches: this.positiveNumber(
        configLimits.branches,
        DEFAULT_LIMITS.branches,
      ),
      whatsappNumbers: this.positiveNumber(
        configLimits.whatsappNumbers,
        DEFAULT_LIMITS.whatsappNumbers,
      ),
      users: this.positiveNumber(configLimits.users, DEFAULT_LIMITS.users),
    };
  }

  private applyAddonCapacity(limits: CapacityMap, config: any) {
    const capacity = config?.capacity ?? {};

    limits.branches += this.positiveNumber(capacity.branches, 0);
    limits.whatsappNumbers += this.positiveNumber(capacity.whatsappNumbers, 0);
    limits.users += this.positiveNumber(capacity.users, 0);
  }

  private async getUsedCapacity(tenantId: string): Promise<CapacityMap> {
    const [branchCount, whatsappRows, userCount] = await Promise.all([
      this.prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
        SELECT COUNT(*)::bigint AS count
        FROM tenant_schema.tenant_branches
        WHERE tenant_id = ${tenantId}::uuid
          AND active = TRUE
      `),
      this.prisma.$queryRaw<Array<{ whatsappNumber: string }>>(Prisma.sql`
        SELECT whatsapp_number AS "whatsappNumber"
        FROM tenant_schema.whatsapp_configs
        WHERE tenant_id = ${tenantId}::uuid
          AND NULLIF(TRIM(whatsapp_number), '') IS NOT NULL
        UNION
        SELECT whatsapp_number AS "whatsappNumber"
        FROM tenant_schema.tenant_branches
        WHERE tenant_id = ${tenantId}::uuid
          AND active = TRUE
          AND NULLIF(TRIM(whatsapp_number), '') IS NOT NULL
      `),
      this.prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
        SELECT COUNT(*)::bigint AS count
        FROM tenant_schema.users
        WHERE tenant_id = ${tenantId}::uuid
      `),
    ]);

    return {
      branches: Number(branchCount[0]?.count ?? 0),
      whatsappNumbers: whatsappRows.length,
      users: Number(userCount[0]?.count ?? 0),
    };
  }

  private positiveNumber(value: unknown, fallback: number): number {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) && numberValue >= 0
      ? numberValue
      : fallback;
  }
}
