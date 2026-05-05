import { PlatformTenantBillingReadDao } from '../infrastructure/PlatformTenantBillingReadDao';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';

describe('PlatformTenantBillingReadDao', () => {
  it('maps prisma rows to overview items', async () => {
    const prisma = {
      tenant: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 't1',
            companyName: 'Acme',
            cnpj: '00.000.000/0001-00',
            plan: 'PROFISSIONAL',
            planStatus: 'ACTIVE',
            createdAt: new Date('2026-01-01'),
          },
        ]),
        count: jest.fn().mockResolvedValue(1),
      },
      subscription: {
        findMany: jest.fn().mockResolvedValue([
          {
            tenantId: 't1',
            plan: 'PROFISSIONAL',
            status: 'ACTIVE',
            messagesQuota: 100,
            aiTokensQuota: 200,
            contactsQuota: 300,
            billingCycleStart: new Date('2026-04-01'),
            billingCycleEnd: new Date('2026-05-01'),
            createdAt: new Date('2026-01-15'),
          },
        ]),
      },
      usageRecord: {
        findMany: jest.fn().mockResolvedValue([
          {
            tenantId: 't1',
            messagesUsed: 1,
            aiTokensUsed: 2,
            contactsUsed: 3,
            periodStart: new Date('2026-04-01'),
            periodEnd: new Date('2026-05-01'),
          },
        ]),
      },
    } as unknown as PrismaService;

    const dao = new PlatformTenantBillingReadDao(prisma);
    const result = await dao.listOverview({ page: 1, limit: 20 });
    expect(result.total).toBe(1);
    expect(result.items[0].tenantId).toBe('t1');
    expect(result.items[0].quotas.messages.limit).toBe(100);
    expect(result.items[0].usage.messages.used).toBe(1);
  });
});
