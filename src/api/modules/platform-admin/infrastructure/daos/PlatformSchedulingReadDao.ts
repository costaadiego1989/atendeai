import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { resolveDateRange } from './date-range.util';

export interface SchedulingMetricsResult {
  period: { start: Date; end: Date };
  activeRecurrences: number;
  recurrencesByStatus: Record<string, number>;
  totalOccurrencesCreated: number;
  runsByStatus: Record<string, number>;
  topTenantsByRecurrences: Array<{
    tenantId: string;
    companyName: string;
    count: number;
  }>;
}

export interface RecurrenceListItem {
  id: string;
  tenantId: string;
  companyName: string;
  professionalId: string;
  period: string;
  interval: number;
  maxOccurrences: number;
  occurrencesCreated: number;
  status: string;
  isFree: boolean;
  isOnline: boolean;
  firstDate: Date;
  nextDate: Date | null;
  createdAt: Date;
}

@Injectable()
export class PlatformSchedulingReadDao {
  constructor(private readonly prisma: PrismaService) {}

  async getMetrics(input: {
    period?: '1d' | '7d' | '30d' | '90d' | 'custom';
    startDate?: string;
    endDate?: string;
    tenantId?: string;
  }): Promise<SchedulingMetricsResult> {
    const { start, end } = resolveDateRange(input);
    const tenantFilter = input.tenantId ? { tenantId: input.tenantId } : {};

    const [
      activeRecurrences,
      statusGroups,
      occurrencesAgg,
      runStatusGroups,
      topTenants,
    ] = await Promise.all([
      this.prisma.schedulingRecurringReservation.count({
        where: { ...tenantFilter, status: 'ACTIVE' },
      }),
      this.prisma.schedulingRecurringReservation.groupBy({
        by: ['status'],
        where: tenantFilter,
        _count: true,
      }),
      this.prisma.schedulingRecurringReservation.aggregate({
        where: {
          ...tenantFilter,
          createdAt: { gte: start, lte: end },
        },
        _sum: { occurrencesCreated: true },
      }),
      this.prisma.schedulingRecurringReservationRun.groupBy({
        by: ['status'],
        where: {
          ...tenantFilter,
          createdAt: { gte: start, lte: end },
        },
        _count: true,
      }),
      this.prisma.schedulingRecurringReservation.groupBy({
        by: ['tenantId'],
        where: { status: 'ACTIVE' },
        _count: true,
        orderBy: { _count: { tenantId: 'desc' } },
        take: 10,
      }),
    ]);

    const tenantIds = topTenants.map((t) => t.tenantId);
    const tenants = await this.prisma.tenant.findMany({
      where: { id: { in: tenantIds } },
      select: { id: true, companyName: true },
    });
    const tenantMap = new Map(tenants.map((t) => [t.id, t.companyName]));

    return {
      period: { start, end },
      activeRecurrences,
      recurrencesByStatus: Object.fromEntries(
        statusGroups.map((g) => [g.status, g._count]),
      ),
      totalOccurrencesCreated: occurrencesAgg._sum.occurrencesCreated ?? 0,
      runsByStatus: Object.fromEntries(
        runStatusGroups.map((g) => [g.status, g._count]),
      ),
      topTenantsByRecurrences: topTenants.map((t) => ({
        tenantId: t.tenantId,
        companyName: tenantMap.get(t.tenantId) ?? 'Unknown',
        count: t._count,
      })),
    };
  }

  async listRecurrences(input: {
    page: number;
    limit: number;
    tenantId?: string;
    status?: string;
  }): Promise<{ items: RecurrenceListItem[]; total: number }> {
    const skip = (input.page - 1) * input.limit;
    const where: Record<string, unknown> = {};
    if (input.tenantId) where.tenantId = input.tenantId;
    if (input.status) where.status = input.status;

    const [recurrences, total] = await Promise.all([
      this.prisma.schedulingRecurringReservation.findMany({
        where,
        skip,
        take: input.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.schedulingRecurringReservation.count({ where }),
    ]);

    const tenantIds = [...new Set(recurrences.map((r) => r.tenantId))];
    const tenants = await this.prisma.tenant.findMany({
      where: { id: { in: tenantIds } },
      select: { id: true, companyName: true },
    });
    const tenantMap = new Map(tenants.map((t) => [t.id, t.companyName]));

    const items: RecurrenceListItem[] = recurrences.map((r) => ({
      id: r.id,
      tenantId: r.tenantId,
      companyName: tenantMap.get(r.tenantId) ?? 'Unknown',
      professionalId: r.professionalId,
      period: r.period,
      interval: r.interval,
      maxOccurrences: r.maxOccurrences,
      occurrencesCreated: r.occurrencesCreated,
      status: r.status,
      isFree: r.isFree,
      isOnline: r.isOnline,
      firstDate: r.firstDate,
      nextDate: r.nextDate,
      createdAt: r.createdAt,
    }));

    return { items, total };
  }
}
