import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { resolveDateRange } from './date-range.util';

export interface SalesMetricsResult {
  period: { start: Date; end: Date };
  gmvTotal: number;
  totalMessages: number;
  purchaseIntents: number;
  paymentLinksGenerated: number;
  conversionRate: number;
  topTenantsByRevenue: Array<{
    tenantId: string;
    companyName: string;
    revenue: number;
  }>;
  dailyRevenue: Array<{ date: string; revenue: number }>;
}

export interface PaymentLinkListItem {
  id: string;
  tenantId: string;
  companyName: string;
  contactName: string | null;
  name: string;
  value: number;
  status: string;
  billingType: string;
  source: string;
  expiresAt: Date | null;
  createdAt: Date;
}

@Injectable()
export class PlatformSalesReadDao {
  constructor(private readonly prisma: PrismaService) {}

  async getMetrics(input: {
    period?: '1d' | '7d' | '30d' | '90d' | 'custom';
    startDate?: string;
    endDate?: string;
    tenantId?: string;
  }): Promise<SalesMetricsResult> {
    const { start, end } = resolveDateRange(input);
    const where: Record<string, unknown> = {
      date: { gte: start, lte: end },
    };
    if (input.tenantId) where.tenantId = input.tenantId;

    const [aggregate, dailyMetrics, topTenants] = await Promise.all([
      // Global aggregation
      this.prisma.salesMetric.aggregate({
        where,
        _sum: {
          estimatedRevenue: true,
          totalMessages: true,
          purchaseIntents: true,
          paymentLinksGenerated: true,
        },
      }),
      // Daily revenue breakdown
      this.prisma.salesMetric.groupBy({
        by: ['date'],
        where,
        _sum: { estimatedRevenue: true },
        orderBy: { date: 'asc' },
      }),
      // Top tenants by revenue
      this.prisma.salesMetric.groupBy({
        by: ['tenantId'],
        where,
        _sum: { estimatedRevenue: true },
        orderBy: { _sum: { estimatedRevenue: 'desc' } },
        take: 10,
      }),
    ]);

    // Resolve tenant names
    const tenantIds = topTenants.map((t) => t.tenantId);
    const tenants = await this.prisma.tenant.findMany({
      where: { id: { in: tenantIds } },
      select: { id: true, companyName: true },
    });
    const tenantMap = new Map(tenants.map((t) => [t.id, t.companyName]));

    const intents = aggregate._sum.purchaseIntents ?? 0;
    const links = aggregate._sum.paymentLinksGenerated ?? 0;
    const conversionRate = intents > 0 ? (links / intents) * 100 : 0;

    return {
      period: { start, end },
      gmvTotal: Number(aggregate._sum.estimatedRevenue ?? 0),
      totalMessages: aggregate._sum.totalMessages ?? 0,
      purchaseIntents: intents,
      paymentLinksGenerated: links,
      conversionRate: Math.round(conversionRate * 100) / 100,
      topTenantsByRevenue: topTenants.map((t) => ({
        tenantId: t.tenantId,
        companyName: tenantMap.get(t.tenantId) ?? 'Unknown',
        revenue: Number(t._sum.estimatedRevenue ?? 0),
      })),
      dailyRevenue: dailyMetrics.map((d) => ({
        date: d.date.toISOString().split('T')[0],
        revenue: Number(d._sum.estimatedRevenue ?? 0),
      })),
    };
  }

  async listPaymentLinks(input: {
    page: number;
    limit: number;
    tenantId?: string;
    status?: string;
    billingType?: string;
    period?: '1d' | '7d' | '30d' | '90d' | 'custom';
    startDate?: string;
    endDate?: string;
  }): Promise<{ items: PaymentLinkListItem[]; total: number }> {
    const skip = (input.page - 1) * input.limit;
    const { start, end } = resolveDateRange(input);
    const where: Record<string, unknown> = {
      createdAt: { gte: start, lte: end },
    };
    if (input.tenantId) where.tenantId = input.tenantId;
    if (input.status) where.status = input.status;
    if (input.billingType) where.billingType = input.billingType;

    const [links, total] = await Promise.all([
      this.prisma.paymentLink.findMany({
        where,
        skip,
        take: input.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          contact: { select: { name: true } },
        },
      }),
      this.prisma.paymentLink.count({ where }),
    ]);

    // Resolve tenant names
    const tenantIds = [...new Set(links.map((l) => l.tenantId))];
    const tenants = await this.prisma.tenant.findMany({
      where: { id: { in: tenantIds } },
      select: { id: true, companyName: true },
    });
    const tenantMap = new Map(tenants.map((t) => [t.id, t.companyName]));

    const items: PaymentLinkListItem[] = links.map((l) => ({
      id: l.id,
      tenantId: l.tenantId,
      companyName: tenantMap.get(l.tenantId) ?? 'Unknown',
      contactName: l.contact?.name ?? null,
      amount: Number(l.amount),
      status: l.status,
      billingType: l.billingType ?? null,
      expiresAt: l.expiresAt ?? null,
      paidAt: l.paidAt ?? null,
      createdAt: l.createdAt,
    }));

    return { items, total };
  }
}
