import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { resolveDateRange } from './date-range.util';

export interface AuthMetricsResult {
  period: { start: Date; end: Date };
  totalEvents: number;
  eventsByType: Record<string, number>;
  uniqueUsers: number;
  failedLogins: number;
  topTenantsByActivity: Array<{
    tenantId: string;
    companyName: string;
    count: number;
  }>;
}

@Injectable()
export class PlatformAuthReadDao {
  constructor(private readonly prisma: PrismaService) {}

  async getMetrics(input: {
    period?: '1d' | '7d' | '30d' | '90d' | 'custom';
    startDate?: string;
    endDate?: string;
    tenantId?: string;
  }): Promise<AuthMetricsResult> {
    const { start, end } = resolveDateRange(input);
    const tenantFilter = input.tenantId ? { tenantId: input.tenantId } : {};

    const [eventsByType, uniqueUsersResult, failedLogins, topTenants] =
      await Promise.all([
        this.prisma.authAuditLog.groupBy({
          by: ['eventType'],
          where: { ...tenantFilter, createdAt: { gte: start, lte: end } },
          _count: true,
        }),
        this.prisma.authAuditLog.findMany({
          where: {
            ...tenantFilter,
            createdAt: { gte: start, lte: end },
            userId: { not: null },
          },
          distinct: ['userId'],
          select: { userId: true },
        }),
        this.prisma.authAuditLog.count({
          where: {
            ...tenantFilter,
            createdAt: { gte: start, lte: end },
            eventType: { contains: 'FAIL' },
          },
        }),
        this.prisma.authAuditLog.groupBy({
          by: ['tenantId'],
          where: { createdAt: { gte: start, lte: end } },
          _count: true,
          orderBy: { _count: { tenantId: 'desc' } },
          take: 10,
        }),
      ]);

    const totalEvents = eventsByType.reduce((sum, g) => sum + g._count, 0);

    const tenantIds = topTenants.map((t) => t.tenantId);
    const tenants = await this.prisma.tenant.findMany({
      where: { id: { in: tenantIds } },
      select: { id: true, companyName: true },
    });
    const tenantMap = new Map(tenants.map((t) => [t.id, t.companyName]));

    return {
      period: { start, end },
      totalEvents,
      eventsByType: Object.fromEntries(
        eventsByType.map((g) => [g.eventType, g._count]),
      ),
      uniqueUsers: uniqueUsersResult.length,
      failedLogins,
      topTenantsByActivity: topTenants.map((t) => ({
        tenantId: t.tenantId,
        companyName: tenantMap.get(t.tenantId) ?? 'Unknown',
        count: t._count,
      })),
    };
  }
}
