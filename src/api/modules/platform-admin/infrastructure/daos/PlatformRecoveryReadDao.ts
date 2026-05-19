import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { resolveDateRange } from './date-range.util';

export interface RecoveryMetricsResult {
  period: { start: Date; end: Date };
  totalActiveCases: number;
  totalAmountDue: number;
  casesByStatus: Record<string, number>;
  casesBySource: Record<string, number>;
  recoveredValue: number;
  recoveryRate: number;
  casesWithoutContact7d: number;
  topTenantsByAmountDue: Array<{
    tenantId: string;
    companyName: string;
    totalDue: number;
  }>;
}

export interface RecoveryCaseListItem {
  id: string;
  tenantId: string;
  companyName: string;
  debtorName: string;
  phone: string;
  amountDue: number | null;
  dueDate: Date | null;
  status: string;
  source: string;
  chargeType: string | null;
  lastContactedAt: Date | null;
  createdAt: Date;
}

@Injectable()
export class PlatformRecoveryReadDao {
  constructor(private readonly prisma: PrismaService) {}

  async getMetrics(input: {
    period?: '1d' | '7d' | '30d' | '90d' | 'custom';
    startDate?: string;
    endDate?: string;
    tenantId?: string;
  }): Promise<RecoveryMetricsResult> {
    const { start, end } = resolveDateRange(input);
    const tenantFilter = input.tenantId ? { tenantId: input.tenantId } : {};

    const [
      activeCases,
      statusGroups,
      sourceGroups,
      paidCases,
      totalCasesInPeriod,
      casesWithoutContact,
      topTenants,
    ] = await Promise.all([
      // Total active (non-terminal) cases
      this.prisma.recoveryCase.count({
        where: {
          ...tenantFilter,
          status: { notIn: ['PAID', 'LOST', 'CANCELLED'] },
        },
      }),
      // Cases by status
      this.prisma.recoveryCase.groupBy({
        by: ['status'],
        where: {
          ...tenantFilter,
          createdAt: { gte: start, lte: end },
        },
        _count: true,
      }),
      // Cases by source
      this.prisma.recoveryCase.groupBy({
        by: ['source'],
        where: {
          ...tenantFilter,
          createdAt: { gte: start, lte: end },
        },
        _count: true,
      }),
      // Paid cases (recovered) in period
      this.prisma.recoveryCase.aggregate({
        where: {
          ...tenantFilter,
          status: 'PAID',
          paidAt: { gte: start, lte: end },
        },
        _count: true,
        _sum: { amountDue: true },
      }),
      // Total cases in period
      this.prisma.recoveryCase.count({
        where: {
          ...tenantFilter,
          createdAt: { gte: start, lte: end },
        },
      }),
      // Cases without contact > 7 days
      this.prisma.recoveryCase.count({
        where: {
          ...tenantFilter,
          status: { notIn: ['PAID', 'LOST', 'CANCELLED'] },
          OR: [
            { lastContactedAt: null },
            {
              lastContactedAt: {
                lte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
              },
            },
          ],
        },
      }),
      // Top tenants by amount due
      this.prisma.recoveryCase.groupBy({
        by: ['tenantId'],
        where: {
          status: { notIn: ['PAID', 'LOST', 'CANCELLED'] },
        },
        _sum: { amountDue: true },
        orderBy: { _sum: { amountDue: 'desc' } },
        take: 10,
      }),
    ]);

    // Total amount due (active cases)
    const totalAmountAgg = await this.prisma.recoveryCase.aggregate({
      where: {
        ...tenantFilter,
        status: { notIn: ['PAID', 'LOST', 'CANCELLED'] },
      },
      _sum: { amountDue: true },
    });

    // Resolve tenant names
    const tenantIds = topTenants.map((t) => t.tenantId);
    const tenants = await this.prisma.tenant.findMany({
      where: { id: { in: tenantIds } },
      select: { id: true, companyName: true },
    });
    const tenantMap = new Map(tenants.map((t) => [t.id, t.companyName]));

    const recoveredValue = Number(paidCases._sum.amountDue ?? 0);
    const recoveryRate =
      totalCasesInPeriod > 0
        ? Math.round(((paidCases._count ?? 0) / totalCasesInPeriod) * 10000) /
          100
        : 0;

    return {
      period: { start, end },
      totalActiveCases: activeCases,
      totalAmountDue: Number(totalAmountAgg._sum.amountDue ?? 0),
      casesByStatus: Object.fromEntries(
        statusGroups.map((g) => [g.status, g._count]),
      ),
      casesBySource: Object.fromEntries(
        sourceGroups.map((g) => [g.source, g._count]),
      ),
      recoveredValue,
      recoveryRate,
      casesWithoutContact7d: casesWithoutContact,
      topTenantsByAmountDue: topTenants.map((t) => ({
        tenantId: t.tenantId,
        companyName: tenantMap.get(t.tenantId) ?? 'Unknown',
        totalDue: Number(t._sum.amountDue ?? 0),
      })),
    };
  }

  async listCases(input: {
    page: number;
    limit: number;
    tenantId?: string;
    status?: string;
    source?: string;
  }): Promise<{ items: RecoveryCaseListItem[]; total: number }> {
    const skip = (input.page - 1) * input.limit;
    const where: Record<string, unknown> = {};
    if (input.tenantId) where.tenantId = input.tenantId;
    if (input.status) where.status = input.status;
    if (input.source) where.source = input.source;

    const [cases, total] = await Promise.all([
      this.prisma.recoveryCase.findMany({
        where,
        skip,
        take: input.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.recoveryCase.count({ where }),
    ]);

    const tenantIds = [...new Set(cases.map((c) => c.tenantId))];
    const tenants = await this.prisma.tenant.findMany({
      where: { id: { in: tenantIds } },
      select: { id: true, companyName: true },
    });
    const tenantMap = new Map(tenants.map((t) => [t.id, t.companyName]));

    const items: RecoveryCaseListItem[] = cases.map((c) => ({
      id: c.id,
      tenantId: c.tenantId,
      companyName: tenantMap.get(c.tenantId) ?? 'Unknown',
      debtorName: c.debtorName,
      phone: c.phone,
      amountDue: c.amountDue ? Number(c.amountDue) : null,
      dueDate: c.dueDate,
      status: c.status,
      source: c.source,
      chargeType: c.chargeType,
      lastContactedAt: c.lastContactedAt,
      createdAt: c.createdAt,
    }));

    return { items, total };
  }
}
