import { PlatformRecoveryReadDao } from '../infrastructure/daos/PlatformRecoveryReadDao';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';

describe('PlatformRecoveryReadDao', () => {
  const prisma = {
    recoveryCase: {
      count: jest.fn(),
      groupBy: jest.fn(),
      aggregate: jest.fn(),
      findMany: jest.fn(),
    },
    tenant: {
      findMany: jest.fn(),
    },
  } as unknown as PrismaService;

  const dao = new PlatformRecoveryReadDao(prisma);

  beforeEach(() => jest.clearAllMocks());

  it('returns recovery metrics with amounts and rates', async () => {
    (prisma.recoveryCase.count as jest.Mock)
      .mockResolvedValueOnce(30) // active cases
      .mockResolvedValueOnce(50) // total in period
      .mockResolvedValueOnce(8); // without contact 7d
    (prisma.recoveryCase.groupBy as jest.Mock)
      .mockResolvedValueOnce([
        { status: 'READY_TO_CONTACT', _count: 15 },
        { status: 'IN_PROGRESS', _count: 10 },
        { status: 'PAID', _count: 20 },
      ])
      .mockResolvedValueOnce([
        { source: 'MANUAL', _count: 25 },
        { source: 'RECURRING', _count: 20 },
      ])
      .mockResolvedValueOnce([
        { tenantId: 't1', _sum: { amountDue: 5000 } },
      ]);
    (prisma.recoveryCase.aggregate as jest.Mock)
      .mockResolvedValueOnce({ _count: 20, _sum: { amountDue: 15000 } }) // paid
      .mockResolvedValueOnce({ _sum: { amountDue: 25000 } }); // total due
    (prisma.tenant.findMany as jest.Mock).mockResolvedValue([
      { id: 't1', companyName: 'Acme' },
    ]);

    const result = await dao.getMetrics({ period: '30d' });

    expect(result.totalActiveCases).toBe(30);
    expect(result.totalAmountDue).toBe(25000);
    expect(result.recoveredValue).toBe(15000);
    expect(result.recoveryRate).toBe(40); // 20/50 * 100
    expect(result.casesWithoutContact7d).toBe(8);
    expect(result.casesByStatus).toEqual({ READY_TO_CONTACT: 15, IN_PROGRESS: 10, PAID: 20 });
    expect(result.topTenantsByAmountDue[0].companyName).toBe('Acme');
  });

  it('lists cases with tenant names', async () => {
    (prisma.recoveryCase.findMany as jest.Mock).mockResolvedValue([
      { id: 'rc1', tenantId: 't1', debtorName: 'John', phone: '+5511999', amountDue: 500, dueDate: new Date(), status: 'IN_PROGRESS', source: 'MANUAL', chargeType: 'INVOICE', lastContactedAt: null, createdAt: new Date() },
    ]);
    (prisma.recoveryCase.count as jest.Mock).mockResolvedValue(1);
    (prisma.tenant.findMany as jest.Mock).mockResolvedValue([
      { id: 't1', companyName: 'Acme' },
    ]);

    const result = await dao.listCases({ page: 1, limit: 20 });

    expect(result.total).toBe(1);
    expect(result.items[0].debtorName).toBe('John');
    expect(result.items[0].companyName).toBe('Acme');
    expect(result.items[0].amountDue).toBe(500);
  });
});
