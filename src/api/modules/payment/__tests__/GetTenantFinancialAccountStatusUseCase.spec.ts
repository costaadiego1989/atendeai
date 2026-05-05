import { GetTenantFinancialAccountStatusUseCase } from '../application/use-cases/GetTenantFinancialAccountStatusUseCase';

describe('GetTenantFinancialAccountStatusUseCase', () => {
  it('should return not configured when account does not exist', async () => {
    const repository = {
      findByTenantId: jest.fn().mockResolvedValue(null),
    };

    const useCase = new GetTenantFinancialAccountStatusUseCase(repository as any);

    await expect(useCase.execute('tenant-1')).resolves.toEqual({
      configured: false,
      provider: 'ASAAS',
      status: 'NOT_CONFIGURED',
      walletId: null,
      accountId: null,
    });
  });

  it('should return configured account metadata', async () => {
    const repository = {
      findByTenantId: jest.fn().mockResolvedValue({
        id: 'fin-1',
        tenantId: 'tenant-1',
        provider: 'ASAAS',
        asaasAccountId: 'acc_123',
        walletId: 'wallet_123',
        status: 'ACTIVE',
      }),
    };

    const useCase = new GetTenantFinancialAccountStatusUseCase(repository as any);

    await expect(useCase.execute('tenant-1')).resolves.toEqual({
      configured: true,
      provider: 'ASAAS',
      status: 'ACTIVE',
      walletId: 'wallet_123',
      accountId: 'acc_123',
    });
  });
});
