import { ListBillingPlansUseCase } from '../application/use-cases/ListBillingPlansUseCase';

describe('ListBillingPlansUseCase', () => {
  it('should return the active plan catalog for the tenant context', async () => {
    const billingRepository = {
      listPlans: jest.fn().mockResolvedValue([
        {
          code: 'ESSENCIAL',
          displayName: 'Essencial',
          description: 'Plano de entrada',
          monthlyPrice: 0,
          messagesQuota: 2000,
          aiTokensQuota: 500000,
          contactsQuota: 500,
          sortOrder: 1,
          active: true,
        },
      ]),
    };

    const sut = new ListBillingPlansUseCase(billingRepository as any);

    const result = await sut.execute({ tenantId: 'tenant-1' });

    expect(result).toEqual({
      tenantId: 'tenant-1',
      plans: [
        expect.objectContaining({
          code: 'ESSENCIAL',
          monthlyPrice: 0,
          messagesQuota: 2000,
        }),
      ],
    });
  });
});
