import { PlatformDashboardReadDao } from '../infrastructure/daos/PlatformDashboardReadDao';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';

describe('PlatformDashboardReadDao', () => {
  const prisma = {
    tenant: {
      count: jest.fn(),
    },
    subscription: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    usageRecord: {
      aggregate: jest.fn(),
    },
    conversation: {
      count: jest.fn(),
    },
    salesMetric: {
      aggregate: jest.fn(),
    },
    supportFeedback: {
      count: jest.fn(),
    },
  } as unknown as PrismaService;

  const dao = new PlatformDashboardReadDao(prisma);

  beforeEach(() => jest.clearAllMocks());

  it('returns consolidated overview metrics', async () => {
    (prisma.tenant.count as jest.Mock)
      .mockResolvedValueOnce(50) // totalActive
      .mockResolvedValueOnce(5) // newInPeriod
      .mockResolvedValueOnce(10); // inTrial
    (prisma.subscription.count as jest.Mock).mockResolvedValue(2); // churned
    (prisma.subscription.findMany as jest.Mock).mockResolvedValue([
      { plan: 'PRO', totalMonthlyPrice: 199.9 },
      { plan: 'STARTER', totalMonthlyPrice: 49.9 },
    ]);
    (prisma.usageRecord.aggregate as jest.Mock).mockResolvedValue({
      _sum: { messagesUsed: 1000, aiTokensUsed: 5000, contactsUsed: 200 },
    });
    (prisma.conversation.count as jest.Mock).mockResolvedValue(15);
    (prisma.salesMetric.aggregate as jest.Mock).mockResolvedValue({
      _sum: { estimatedRevenue: 10000, purchaseIntents: 100, paymentLinksGenerated: 30 },
    });
    (prisma.supportFeedback.count as jest.Mock).mockResolvedValue(3);

    const result = await dao.getOverview({ period: '30d' });

    expect(result.tenants.totalActive).toBe(50);
    expect(result.tenants.newInPeriod).toBe(5);
    expect(result.tenants.inTrial).toBe(10);
    expect(result.tenants.churned).toBe(2);
    expect(result.revenue.mrr).toBe(249.8);
    expect(result.revenue.arr).toBe(2997.6);
    expect(result.revenue.byPlan).toEqual({ PRO: 199.9, STARTER: 49.9 });
    expect(result.operations.totalMessages).toBe(1000);
    expect(result.operations.totalAiTokens).toBe(5000);
    expect(result.operations.activeConversations).toBe(15);
    expect(result.sales.totalRevenue).toBe(10000);
    expect(result.sales.conversionRate).toBe(30);
    expect(result.support.openTickets).toBe(3);
    expect(result.period.start).toBeInstanceOf(Date);
    expect(result.period.end).toBeInstanceOf(Date);
  });

  it('handles empty data gracefully', async () => {
    (prisma.tenant.count as jest.Mock).mockResolvedValue(0);
    (prisma.subscription.count as jest.Mock).mockResolvedValue(0);
    (prisma.subscription.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.usageRecord.aggregate as jest.Mock).mockResolvedValue({
      _sum: { messagesUsed: null, aiTokensUsed: null, contactsUsed: null },
    });
    (prisma.conversation.count as jest.Mock).mockResolvedValue(0);
    (prisma.salesMetric.aggregate as jest.Mock).mockResolvedValue({
      _sum: { estimatedRevenue: null, purchaseIntents: null, paymentLinksGenerated: null },
    });
    (prisma.supportFeedback.count as jest.Mock).mockResolvedValue(0);

    const result = await dao.getOverview({ period: '7d' });

    expect(result.revenue.mrr).toBe(0);
    expect(result.revenue.arr).toBe(0);
    expect(result.operations.totalMessages).toBe(0);
    expect(result.sales.conversionRate).toBe(0);
  });
});
