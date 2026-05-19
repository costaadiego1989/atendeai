import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { resolveDateRange } from './date-range.util';

export interface CommerceMetricsResult {
  period: { start: Date; end: Date };
  sessionsStarted: number;
  checkoutsCreated: number;
  ordersPaid: number;
  abandonmentRate: number;
  eventsByType: Record<string, number>;
  abandonmentConfigsActive: number;
  topTenantsByOrders: Array<{
    tenantId: string;
    companyName: string;
    count: number;
  }>;
}

@Injectable()
export class PlatformCommerceReadDao {
  constructor(private readonly prisma: PrismaService) {}

  async getMetrics(input: {
    period?: '1d' | '7d' | '30d' | '90d' | 'custom';
    startDate?: string;
    endDate?: string;
    tenantId?: string;
  }): Promise<CommerceMetricsResult> {
    const { start, end } = resolveDateRange(input);
    const tenantFilter = input.tenantId ? { tenantId: input.tenantId } : {};

    const [eventGroups, abandonmentConfigs, topTenants] = await Promise.all([
      this.prisma.commerceAuditLog.groupBy({
        by: ['event'],
        where: {
          ...tenantFilter,
          createdAt: { gte: start, lte: end },
        },
        _count: true,
      }),
      this.prisma.commerceAbandonmentConfig.count({
        where: { active: true },
      }),
      this.prisma.commerceAuditLog.groupBy({
        by: ['tenantId'],
        where: {
          event: 'ORDER_PAID',
          createdAt: { gte: start, lte: end },
        },
        _count: true,
        orderBy: { _count: { tenantId: 'desc' } },
        take: 10,
      }),
    ]);

    const eventsByType = Object.fromEntries(
      eventGroups.map((g) => [g.event, g._count]),
    );

    const sessionsStarted = eventsByType['SESSION_STARTED'] ?? 0;
    const checkoutsCreated = eventsByType['CHECKOUT_CREATED'] ?? 0;
    const ordersPaid = eventsByType['ORDER_PAID'] ?? 0;
    const abandonmentRate =
      sessionsStarted > 0
        ? Math.round(
            ((sessionsStarted - ordersPaid) / sessionsStarted) * 10000,
          ) / 100
        : 0;

    // Resolve tenant names
    const tenantIds = topTenants.map((t) => t.tenantId);
    const tenants = await this.prisma.tenant.findMany({
      where: { id: { in: tenantIds } },
      select: { id: true, companyName: true },
    });
    const tenantMap = new Map(tenants.map((t) => [t.id, t.companyName]));

    return {
      period: { start, end },
      sessionsStarted,
      checkoutsCreated,
      ordersPaid,
      abandonmentRate,
      eventsByType,
      abandonmentConfigsActive: abandonmentConfigs,
      topTenantsByOrders: topTenants.map((t) => ({
        tenantId: t.tenantId,
        companyName: tenantMap.get(t.tenantId) ?? 'Unknown',
        count: t._count,
      })),
    };
  }
}
