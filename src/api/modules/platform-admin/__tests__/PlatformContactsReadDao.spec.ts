import { PlatformContactsReadDao } from '../infrastructure/daos/PlatformContactsReadDao';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';

describe('PlatformContactsReadDao', () => {
  const prisma = {
    contact: {
      count: jest.fn(),
      groupBy: jest.fn(),
      findMany: jest.fn(),
    },
    tenant: {
      findMany: jest.fn(),
    },
  } as unknown as PrismaService;

  const dao = new PlatformContactsReadDao(prisma);

  beforeEach(() => jest.clearAllMocks());

  it('returns contacts metrics with stage distribution', async () => {
    (prisma.contact.count as jest.Mock)
      .mockResolvedValueOnce(1000) // total
      .mockResolvedValueOnce(50) // new in period
      .mockResolvedValueOnce(30) // opt out
      .mockResolvedValueOnce(200); // inactive 30d
    (prisma.contact.groupBy as jest.Mock)
      .mockResolvedValueOnce([
        { stage: 'LEAD', _count: 400 },
        { stage: 'CUSTOMER', _count: 600 },
      ])
      .mockResolvedValueOnce([
        { tenantId: 't1', _count: 500 },
        { tenantId: 't2', _count: 300 },
      ]);
    (prisma.tenant.findMany as jest.Mock).mockResolvedValue([
      { id: 't1', companyName: 'Acme' },
      { id: 't2', companyName: 'Beta' },
    ]);

    const result = await dao.getMetrics({ period: '30d' });

    expect(result.totalContacts).toBe(1000);
    expect(result.newInPeriod).toBe(50);
    expect(result.prospectingOptOut).toBe(30);
    expect(result.inactiveOver30d).toBe(200);
    expect(result.byStage).toEqual({ LEAD: 400, CUSTOMER: 600 });
    expect(result.topTenantsByContacts).toHaveLength(2);
  });

  it('lists contacts with search filter', async () => {
    (prisma.contact.findMany as jest.Mock).mockResolvedValue([
      { id: 'c1', tenantId: 't1', name: 'John', phone: '+5511999', email: 'john@test.com', stage: 'LEAD', prospectingOptOut: false, lastInteraction: null, createdAt: new Date() },
    ]);
    (prisma.contact.count as jest.Mock).mockResolvedValue(1);
    (prisma.tenant.findMany as jest.Mock).mockResolvedValue([
      { id: 't1', companyName: 'Acme' },
    ]);

    const result = await dao.listContacts({ page: 1, limit: 20, search: 'John' });

    expect(result.total).toBe(1);
    expect(result.items[0].name).toBe('John');
    expect(result.items[0].companyName).toBe('Acme');
  });
});
