import { PlatformBillingReadDao } from '../infrastructure/daos/PlatformBillingReadDao';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';

describe('PlatformBillingReadDao', () => {
  const prisma = {
    subscription: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    billingAuditLog: {
      findMany: jest.fn(),
    },
    usageRecord: {
      findMany: jest.fn(),
    },
    tenant: {
      findMany: jest.fn(),
    },
  } as unknown as PrismaService;

  const dao = new PlatformBillingReadDao(prisma);

  beforeEach(() => jest.clearAllMocks());

  it('calculates MRR, ARPU, and churn correctly', async () => {
    (prisma.subscription.findMany as jest.Mock).mockResolvedValue([
      { tenantId: 't1', plan: 'PRO', totalMonthlyPrice: 200, baseMonthlyPrice: 150, addonsMonthlyPrice: 50, messagesQuota: 1000, aiTokensQuota: 5000 },
      { tenantId: 't2', plan: 'STARTER', totalMonthlyPrice: 50, baseMonthlyPrice: 50, addonsMonthlyPrice: 0, messagesQuota: 500, aiTokensQuota: 2000 },
    ]);
    (prisma.billingAuditLog.findMany as jest.Mock).mockResolvedValue([
      { event: 'PLAN_CHANGED', oldPlan: 'STARTER', newPlan: 'PRO' },
      { event: 'SUBSCRIPTION_CANCELLED', oldPlan: null, newPlan: null },
    ]);
    (prisma.usageRecord.findMany as jest.Mock).mockResolvedValue([
      { tenantId: 't1', messagesUsed: 950, aiTokensUsed: 100 },
      { tenantId: 't2', messagesUsed: 100, aiTokensUsed: 50 },
    ]);
    (prisma.subscription.count as jest.Mock).mockResolvedValue(10);

    const result = await dao.getMetrics({ period: '30d' });

    expect(result.mrr).toBe(250);
    expect(result.arr).toBe(3000);
    expect(result.arpu).toBe(125);
    expect(result.upgrades).toBe(1);
    expect(result.downgrades).toBe(0);
    expect(result.cancellations).toBe(1);
    expect(result.churnRate).toBe(10);
    expect(result.addonsRevenue).toBe(50);
    expect(result.tenantsAbove90Quota).toBe(1); // t1 at 950/1000
    expect(result.mrrByPlan).toEqual({ PRO: 200, STARTER: 50 });
  });

  it('lists subscriptions with tenant names', async () => {
    (prisma.subscription.findMany as jest.Mock).mockResolvedValue([
      { tenantId: 't1', plan: 'PRO', status: 'ACTIVE', totalMonthlyPrice: 200, baseMonthlyPrice: 150, addonsMonthlyPrice: 50, billingCycleType: 'MONTHLY', billingCycleStart: new Date(), billingCycleEnd: new Date(), createdAt: new Date() },
    ]);
    (prisma.subscription.count as jest.Mock).mockResolvedValue(1);
    (prisma.tenant.findMany as jest.Mock).mockResolvedValue([
      { id: 't1', companyName: 'Acme' },
    ]);

    const result = await dao.listSubscriptions({ page: 1, limit: 20 });

    expect(result.total).toBe(1);
    expect(result.items[0].companyName).toBe('Acme');
    expect(result.items[0].plan).toBe('PRO');
  });
});
