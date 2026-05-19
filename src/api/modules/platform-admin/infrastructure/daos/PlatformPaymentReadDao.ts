import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { resolveDateRange } from './date-range.util';

export interface PaymentMetricsResult {
  period: { start: Date; end: Date };
  totalAccounts: number;
  accountsByStatus: Record<string, number>;
  tenantsWithoutAccount: number;
  webhooksReceived: number;
  webhooksByStatus: Record<string, number>;
  webhooksByEventType: Record<string, number>;
}

@Injectable()
export class PlatformPaymentReadDao {
  constructor(private readonly prisma: PrismaService) {}

  async getMetrics(input: {
    period?: '1d' | '7d' | '30d' | '90d' | 'custom';
    startDate?: string;
    endDate?: string;
    tenantId?: string;
  }): Promise<PaymentMetricsResult> {
    const { start, end } = resolveDateRange(input);

    const [
      totalAccounts,
      statusGroups,
      activeTenants,
      tenantsWithAccount,
      webhooksReceived,
      webhookStatusGroups,
      webhookEventGroups,
    ] = await Promise.all([
      this.prisma.tenantFinancialAccount.count(),
      this.prisma.tenantFinancialAccount.groupBy({
        by: ['status'],
        _count: true,
      }),
      this.prisma.tenant.count({ where: { planStatus: 'ACTIVE' } }),
      this.prisma.tenantFinancialAccount.count(),
      this.prisma.paymentWebhookReceipt.count({
        where: { createdAt: { gte: start, lte: end } },
      }),
      this.prisma.paymentWebhookReceipt.groupBy({
        by: ['status'],
        where: { createdAt: { gte: start, lte: end } },
        _count: true,
      }),
      this.prisma.paymentWebhookReceipt.groupBy({
        by: ['eventType'],
        where: { createdAt: { gte: start, lte: end } },
        _count: true,
        orderBy: { _count: { eventType: 'desc' } },
        take: 20,
      }),
    ]);

    return {
      period: { start, end },
      totalAccounts,
      accountsByStatus: Object.fromEntries(
        statusGroups.map((g) => [g.status, g._count]),
      ),
      tenantsWithoutAccount: activeTenants - tenantsWithAccount,
      webhooksReceived,
      webhooksByStatus: Object.fromEntries(
        webhookStatusGroups.map((g) => [g.status, g._count]),
      ),
      webhooksByEventType: Object.fromEntries(
        webhookEventGroups.map((g) => [g.eventType, g._count]),
      ),
    };
  }
}
