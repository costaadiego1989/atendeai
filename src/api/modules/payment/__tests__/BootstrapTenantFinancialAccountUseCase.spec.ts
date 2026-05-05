import { BadRequestException } from '@nestjs/common';
import { BootstrapTenantFinancialAccountUseCase } from '../application/use-cases/BootstrapTenantFinancialAccountUseCase';

describe('BootstrapTenantFinancialAccountUseCase', () => {
  let useCase: BootstrapTenantFinancialAccountUseCase;
  let tenantRepository: any;
  let tenantFinancialAccountRepository: any;
  let paymentService: any;

  beforeEach(() => {
    tenantRepository = {
      findById: jest.fn(),
    };
    tenantFinancialAccountRepository = {
      findByTenantId: jest.fn(),
      save: jest.fn(),
    };
    paymentService = {
      createSubaccount: jest.fn(),
      listSubaccounts: jest.fn(),
    };

    useCase = new BootstrapTenantFinancialAccountUseCase(
      tenantRepository,
      tenantFinancialAccountRepository,
      paymentService,
    );
  });

  it('should return the existing financial account when already provisioned', async () => {
    tenantFinancialAccountRepository.findByTenantId.mockResolvedValue({
      id: 'fin-1',
      tenantId: 'tenant-1',
      walletId: 'wallet-1',
      status: 'ACTIVE',
    });

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      companyType: 'LIMITED',
      addressNumber: '100',
    });

    expect(paymentService.createSubaccount).not.toHaveBeenCalled();
    expect(result.walletId).toBe('wallet-1');
  });

  it('should bootstrap an Asaas subaccount from tenant data', async () => {
    tenantFinancialAccountRepository.findByTenantId.mockResolvedValue(null);
    tenantRepository.findById.mockResolvedValue({
      companyName: { value: 'Clinica Sorriso' },
      cnpj: { value: '11.444.777/0001-61' },
      ownerBirthDate: '1989-05-30',
      owner: {
        email: { value: 'owner@test.com' },
        phone: { value: '11999999999' },
      },
      address: {
        zipcode: '01311-000',
        street: 'Avenida Paulista',
        neighborhood: 'Bela Vista',
        city: 'Sao Paulo',
        state: 'SP',
      },
    });
    paymentService.createSubaccount.mockResolvedValue({
      id: 'acc_123',
      walletId: 'wallet_123',
      status: 'PENDING_APPROVAL',
    });
    tenantFinancialAccountRepository.save.mockImplementation(async (record: any) => ({
      ...record,
      createdAt: new Date('2026-03-31T00:00:00.000Z'),
      updatedAt: new Date('2026-03-31T00:00:00.000Z'),
    }));

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      companyType: 'LIMITED',
      addressNumber: '100',
      complement: 'Sala 201',
    });

    expect(paymentService.createSubaccount).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Clinica Sorriso',
        cpfCnpj: '11.444.777/0001-61',
        incomeValue: 5000,
        companyType: 'LIMITED',
        addressNumber: '100',
        birthDate: '1989-05-30',
        province: 'Bela Vista',
      }),
    );
    expect(result.walletId).toBe('wallet_123');
    expect(result.status).toBe('PENDING_APPROVAL');
  });

  it('should require address data before provisioning the financial account', async () => {
    tenantFinancialAccountRepository.findByTenantId.mockResolvedValue(null);
    tenantRepository.findById.mockResolvedValue({
      companyName: { value: 'Clinica Sorriso' },
      cnpj: { value: '11.444.777/0001-61' },
      owner: {
        email: { value: 'owner@test.com' },
        phone: { value: '11999999999' },
      },
      address: null,
    });

    await expect(
      useCase.execute({
        tenantId: 'tenant-1',
        companyType: 'LIMITED',
        addressNumber: '100',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should recover an existing subaccount when Asaas reports duplicated CNPJ', async () => {
    tenantFinancialAccountRepository.findByTenantId.mockResolvedValue(null);
    tenantRepository.findById.mockResolvedValue({
      companyName: { value: 'Clinica Sorriso' },
      cnpj: { value: '11.444.777/0001-61' },
      owner: {
        email: { value: 'owner@test.com' },
        phone: { value: '11999999999' },
      },
      address: {
        zipcode: '01311-000',
        street: 'Avenida Paulista',
        neighborhood: 'Bela Vista',
        city: 'Sao Paulo',
        state: 'SP',
      },
    });
    paymentService.createSubaccount.mockRejectedValue(
      new Error('Asaas API Error: O CNPJ 11444777000161 ja esta em uso.'),
    );
    paymentService.listSubaccounts.mockResolvedValue([
      {
        id: 'acc_existing',
        walletId: 'wallet_existing',
        cpfCnpj: '11444777000161',
        email: 'owner@test.com',
        status: 'PENDING_APPROVAL',
      },
    ]);
    tenantFinancialAccountRepository.save.mockImplementation(async (record: any) => ({
      ...record,
      createdAt: new Date('2026-03-31T00:00:00.000Z'),
      updatedAt: new Date('2026-03-31T00:00:00.000Z'),
    }));

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      birthDate: '1989-05-30',
    });

    expect(paymentService.listSubaccounts).toHaveBeenCalled();
    expect(result.walletId).toBe('wallet_existing');
    expect(result.id).toBe('acc_existing');
  });
});
