import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import {
  IProspectingQueryPort,
  BILLING_PROSPECTING_QUERY_PORT,
} from '../ports/IProspectingQueryPort';

const DEFAULT_DAILY_PROSPECTING_LIMITS: Record<string, number> = {
  ESSENCIAL: 150,
  PROFISSIONAL: 300,
  ESCALA: 1000,
};

@Injectable()
export class BillingProspectingQuotaService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(BILLING_PROSPECTING_QUERY_PORT)
    private readonly prospectingQueryPort: IProspectingQueryPort,
  ) {}

  async assertCanConsume(input: {
    tenantId: string;
    requested: number;
    now?: Date;
  }): Promise<{ used: number; quota: number; remaining: number }> {
    const quota = await this.resolveDailyQuota(input.tenantId);
    const { dayStart, dayEnd } = this.getSaoPauloDayWindow(
      input.now ?? new Date(),
    );
    const used = await this.prospectingQueryPort.countDailySearches(
      input.tenantId,
      dayStart,
      dayEnd,
    );
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
      : (DEFAULT_DAILY_PROSPECTING_LIMITS[plan] ??
          DEFAULT_DAILY_PROSPECTING_LIMITS.ESSENCIAL);
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
