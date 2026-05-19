import { PlatformAIReadDao } from '../infrastructure/daos/PlatformAIReadDao';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';

describe('PlatformAIReadDao', () => {
  const prisma = {
    aISession: {
      count: jest.fn(),
      aggregate: jest.fn(),
      groupBy: jest.fn(),
      findMany: jest.fn(),
    },
    tenant: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
  } as unknown as PrismaService;

  const dao = new PlatformAIReadDao(prisma);

  beforeEach(() => jest.clearAllMocks());

  it('returns AI metrics with tokens and handoff rate', async () => {
    (prisma.aISession.count as jest.Mock)
      .mockResolvedValueOnce(100) // total sessions
      .mockResolvedValueOnce(15); // low confidence
    (prisma.aISession.aggregate as jest.Mock)
      .mockResolvedValueOnce({ _sum: { totalTokens: 50000 } })
      .mockResolvedValueOnce({ _avg: { confidence: 0.85 } });
    (prisma.aISession.groupBy as jest.Mock)
      .mockResolvedValueOnce([
        { intent: 'SALES', _count: 40 },
        { intent: 'SUPPORT', _count: 60 },
      ])
      .mockResolvedValueOnce([
        { sentiment: 'POSITIVE', _count: 70 },
        { sentiment: 'NEGATIVE', _count: 30 },
      ])
      .mockResolvedValueOnce([
        { tenantId: 't1', _sum: { totalTokens: 30000 } },
      ]);
    (prisma.tenant.count as jest.Mock).mockResolvedValue(5); // without AI
    (prisma.tenant.findMany as jest.Mock).mockResolvedValue([
      { id: 't1', companyName: 'Acme' },
    ]);

    const result = await dao.getMetrics({ period: '30d' });

    expect(result.totalSessions).toBe(100);
    expect(result.totalTokensConsumed).toBe(50000);
    expect(result.handoffRate).toBe(15); // 15/100 * 100
    expect(result.averageConfidence).toBe(0.85);
    expect(result.sessionsByIntent).toEqual({ SALES: 40, SUPPORT: 60 });
    expect(result.tenantsWithoutAIConfig).toBe(5);
    expect(result.topTenantsByTokens[0].tokens).toBe(30000);
  });

  it('lists sessions with tenant names', async () => {
    (prisma.aISession.findMany as jest.Mock).mockResolvedValue([
      { id: 's1', tenantId: 't1', conversationId: 'conv1', intent: 'SALES', sentiment: 'POSITIVE', confidence: 0.9, status: 'COMPLETED', totalTokens: 500, createdAt: new Date() },
    ]);
    (prisma.aISession.count as jest.Mock).mockResolvedValue(1);
    (prisma.tenant.findMany as jest.Mock).mockResolvedValue([
      { id: 't1', companyName: 'Acme' },
    ]);

    const result = await dao.listSessions({ page: 1, limit: 20 });

    expect(result.total).toBe(1);
    expect(result.items[0].intent).toBe('SALES');
    expect(result.items[0].confidence).toBe(0.9);
    expect(result.items[0].companyName).toBe('Acme');
  });
});
