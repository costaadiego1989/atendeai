import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';

const DEFAULT_DAILY_PROSPECTING_LIMITS: Record<string, number> = {
  ESSENCIAL: 150,
  PROFISSIONAL: 300,
  ESCALA: 1000,
};

@Injectable()
export class BillingProspectingQuotaService {
  constructor(private readonly prisma: PrismaService) {}

  async assertCanConsume(input: {
    tenantId: string;
    requested: number;
    now?: Date;
  }): Promise<{ used: number; quota: number; remaining: number }> {
    const quota = await this.resolveDailyQuota(input.tenantId);
    const used = await this.getDailyUsage(input.tenantId, input.now ?? new Date());
    const requested = Math.max(1, input.requested);

    if (used + requested > quota) {
      throw new ConflictException(
        `Limite diario de prospeccao atingido. Usado hoje: ${used}. Limite: ${quota}.`,
      );
    }

    return {
      used,
      quota,
      remaining: quota - used - requested,
    };
  }

  private async resolveDailyQuota(tenantId: string): Promise<number> {
    const [row] = await this.prisma.$queryRaw<any[]>(Prisma.sql`
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

    const plan = String(row?.plan ?? 'ESSENCIAL');
    const configuredLimit = Number(row?.planConfig?.limits?.prospectingDaily);

    return Number.isFinite(configuredLimit) && configuredLimit > 0
      ? configuredLimit
      : DEFAULT_DAILY_PROSPECTING_LIMITS[plan] ?? DEFAULT_DAILY_PROSPECTING_LIMITS.ESSENCIAL;
  }

  private async getDailyUsage(tenantId: string, now: Date): Promise<number> {
    const { dayStart, dayEnd } = this.getSaoPauloDayWindow(now);

    try {
      const [row] = await this.prisma.$queryRaw<Array<{ used: number }>>(Prisma.sql`
        SELECT COALESCE(SUM(max_results), 0)::int AS used
        FROM prospecting_schema.prospect_searches
        WHERE tenant_id = ${tenantId}::uuid
          AND created_at >= ${dayStart}::timestamptz
          AND created_at < ${dayEnd}::timestamptz
          AND status IN ('RUNNING', 'COMPLETED')
      `);

      return Number(row?.used ?? 0);
    } catch {
      return 0;
    }
  }

  private getSaoPauloDayWindow(now: Date): { dayStart: Date; dayEnd: Date } {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const dateParts = Object.fromEntries(
      parts
        .filter((part) => part.type !== 'literal')
        .map((part) => [part.type, part.value]),
    );

    const dayStart = new Date(
      `${dateParts.year}-${dateParts.month}-${dateParts.day}T00:00:00-03:00`,
    );
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    return { dayStart, dayEnd };
  }
}
