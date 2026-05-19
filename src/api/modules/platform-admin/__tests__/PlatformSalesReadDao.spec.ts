import { PlatformSalesReadDao } from '../infrastructure/daos/PlatformSalesReadDao';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';

describe('PlatformSalesReadDao', () => {
  const prisma = {
    salesMetric: {
      aggregate: jest.fn(),
      groupBy: jest.fn(),
    },
    paymentLink: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    tenant: {
      findMany: jest.fn(),
    },
    contact: {
      findMany: jest.fn(),
    },
  } as unknown as PrismaService;

  const dao = new PlatformSalesReadDao(prisma);

  beforeEach(() => jest.clearAllMocks());

  it('returns sales metrics with GMV and conversion rate', async () => {
    (prisma.salesMetric.aggregate as jest.Mock).mockResolvedValue({
      _sum: { estimatedRevenue: 50000, totalMessages: 1000, purchaseIntents: 200, paymentLinksGenerated: 80 },
    });
    (prisma.salesMetric.groupBy as jest.Mock)
      .mockResolvedValueOnce([
        { date: new Date('2026-05-01'), _sum: { estimatedRevenue: 25000 } },
        { date: new Date('2026-05-02'), _sum: { estimatedRevenue: 25000 } },
      ])
      .mockResolvedValueOnce([
        { tenantId: 't1', _sum: { estimatedRevenue: 30000 } },
        { tenantId: 't2', _sum: { estimatedRevenue: 20000 } },
      ]);
    (prisma.tenant.findMany as jest.Mock).mockResolvedValue([
      { id: 't1', companyName: 'Acme' },
      { id: 't2', companyName: 'Beta' },
    ]);

    const result = await dao.getMetrics({ period: '7d' });

    expect(result.gmvTotal).toBe(50000);
    expect(result.purchaseIntents).toBe(200);
    expect(result.paymentLinksGenerated).toBe(80);
    expect(result.conversionRate).toBe(40); // 80/200 * 100
    expect(result.dailyRevenue).toHaveLength(2);
    expect(result.topTenantsByRevenue[0].revenue).toBe(30000);
  });

  it('lists payment links with contact names', async () => {
    (prisma.paymentLink.findMany as jest.Mock).mockResolvedValue([
      { id: 'pl1', tenantId: 't1', contactId: 'c1', name: 'Produto X', value: 150.5, status: 'ACTIVE', billingType: 'PIX', source: 'MANUAL', expiresAt: null, createdAt: new Date() },
    ]);
    (prisma.paymentLink.count as jest.Mock).mockResolvedValue(1);
    (prisma.tenant.findMany as jest.Mock).mockResolvedValue([
      { id: 't1', companyName: 'Acme' },
    ]);
    (prisma.contact.findMany as jest.Mock).mockResolvedValue([
      { id: 'c1', name: 'John Doe' },
    ]);

    const result = await dao.listPaymentLinks({ page: 1, limit: 20 });

    expect(result.total).toBe(1);
    expect(result.items[0].contactName).toBe('John Doe');
    expect(result.items[0].value).toBe(150.5);
    expect(result.items[0].companyName).toBe('Acme');
  });
});
