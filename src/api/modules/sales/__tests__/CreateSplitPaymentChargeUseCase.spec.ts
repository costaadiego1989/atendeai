import { BadRequestException, ConflictException } from '@nestjs/common';
import { CreateSplitPaymentChargeUseCase } from '../application/use-cases/CreateSplitPaymentChargeUseCase';
import { SalesPaymentLinkLifecycleService } from '../application/services/SalesPaymentLinkLifecycleService';

describe('CreateSplitPaymentChargeUseCase', () => {
  let useCase: CreateSplitPaymentChargeUseCase;
  let paymentService: any;
  let tenantFinancialAccountRepository: any;
  let contactFinancialProfileRepository: any;
  let contactFacade: any;
  let salesRepository: any;
  let eventBus: any;
  let paymentLinkLifecycleService: SalesPaymentLinkLifecycleService;

  beforeEach(() => {
    paymentService = {
      createCustomer: jest.fn(),
      createPayment: jest.fn(),
    };
    tenantFinancialAccountRepository = {
      findByTenantId: jest.fn(),
    };
    contactFinancialProfileRepository = {
      findByTenantAndContact: jest.fn(),
      save: jest.fn(),
    };
    contactFacade = {
      getContactById: jest.fn(),
    };
    salesRepository = {
      createPaymentLink: jest.fn(),
      incrementMetric: jest.fn(),
    };
    eventBus = {
      publish: jest.fn(),
    };
    paymentLinkLifecycleService = new SalesPaymentLinkLifecycleService(
      salesRepository,
      salesRepository,
      eventBus,
    );

    useCase = new CreateSplitPaymentChargeUseCase(
      paymentService,
      tenantFinancialAccountRepository,
      contactFinancialProfileRepository,
      contactFacade,
      eventBus,
      paymentLinkLifecycleService,
    );
  });

  it('should require the tenant financial account before creating a split charge', async () => {
    tenantFinancialAccountRepository.findByTenantId.mockResolvedValue(null);

    await expect(
      useCase.execute({
        tenantId: 'tenant-1',
        contactId: 'contact-1',
        name: 'Consulta premium',
        value: 90,
        billingType: 'PIX',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('should create a split payment charge with 2% platform fee below R$ 100', async () => {
    tenantFinancialAccountRepository.findByTenantId.mockResolvedValue({
      walletId: 'wallet_tenant_1',
    });
    contactFacade.getContactById.mockResolvedValue({
      contactId: 'contact-1',
      branchId: 'branch-1',
      name: 'Paciente Demo',
      phone: '11999999999',
      email: 'paciente@test.com',
    });
    contactFinancialProfileRepository.findByTenantAndContact.mockResolvedValue(
      null,
    );
    paymentService.createCustomer.mockResolvedValue({ id: 'cus_1' });
    paymentService.createPayment.mockResolvedValue({
      id: 'pay_1',
      status: 'PENDING',
      value: 90,
      billingType: 'PIX',
      dueDate: '2026-04-03',
      invoiceUrl: 'https://pay.test/pay_1',
    });
    salesRepository.createPaymentLink.mockImplementation(
      async (record: any) => ({
        ...record,
        createdAt: new Date('2026-03-31T00:00:00.000Z'),
        updatedAt: new Date('2026-03-31T00:00:00.000Z'),
      }),
    );

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      contactId: 'contact-1',
      customerDocument: '051.781.787-00',
      name: 'Consulta premium',
      value: 90,
      billingType: 'PIX',
    });

    expect(paymentService.createPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        split: [
          {
            walletId: 'wallet_tenant_1',
            percentualValue: 98,
          },
        ],
      }),
    );
    expect(paymentService.createCustomer).toHaveBeenCalledWith(
      expect.objectContaining({
        cpfCnpj: '05178178700',
      }),
    );
    expect(salesRepository.createPaymentLink).toHaveBeenCalledWith(
      expect.objectContaining({
        branchId: 'branch-1',
      }),
    );
    expect(result.platformFeePercent).toBe(2);
  });

  it('should require a customer document when the financial profile does not exist yet', async () => {
    tenantFinancialAccountRepository.findByTenantId.mockResolvedValue({
      walletId: 'wallet_tenant_1',
    });
    contactFacade.getContactById.mockResolvedValue({
      contactId: 'contact-1',
      name: 'Paciente Demo',
      phone: '11999999999',
      email: 'paciente@test.com',
    });
    contactFinancialProfileRepository.findByTenantAndContact.mockResolvedValue(
      null,
    );

    await expect(
      useCase.execute({
        tenantId: 'tenant-1',
        contactId: 'contact-1',
        name: 'Consulta premium',
        value: 90,
        billingType: 'PIX',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reuse the contact customer id and send the charge over WhatsApp', async () => {
    tenantFinancialAccountRepository.findByTenantId.mockResolvedValue({
      walletId: 'wallet_tenant_1',
    });
    contactFacade.getContactById.mockResolvedValue({
      contactId: 'contact-1',
      name: 'Paciente Demo',
      phone: '11999999999',
      email: 'paciente@test.com',
    });
    contactFinancialProfileRepository.findByTenantAndContact.mockResolvedValue({
      asaasCustomerId: 'cus_existing',
    });
    paymentService.createPayment.mockResolvedValue({
      id: 'pay_2',
      status: 'PENDING',
      value: 230,
      billingType: 'PIX',
      dueDate: '2026-04-03',
      invoiceUrl: 'https://pay.test/pay_2',
    });
    salesRepository.createPaymentLink.mockImplementation(
      async (record: any) => ({
        ...record,
        createdAt: new Date('2026-03-31T00:00:00.000Z'),
        updatedAt: new Date('2026-03-31T00:00:00.000Z'),
      }),
    );

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      contactId: 'contact-1',
      name: 'Consulta premium',
      value: 230,
      billingType: 'PIX',
      sendViaWhatsApp: true,
    });

    expect(paymentService.createCustomer).not.toHaveBeenCalled();
    expect(paymentService.createPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: 'cus_existing',
        split: [
          {
            walletId: 'wallet_tenant_1',
            percentualValue: 98.5,
          },
        ],
      }),
    );
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          contactId: 'contact-1',
          invoiceUrl: 'https://pay.test/pay_2',
        }),
      }),
    );
    expect(result.conversationId).toBeNull();
    expect(result.platformFeePercent).toBe(1.5);
  });

  it('should persist recurrence metadata for a recurring split charge', async () => {
    tenantFinancialAccountRepository.findByTenantId.mockResolvedValue({
      walletId: 'wallet_tenant_1',
    });
    contactFacade.getContactById.mockResolvedValue({
      contactId: 'contact-1',
      branchId: 'branch-1',
      name: 'Paciente Demo',
      phone: '11999999999',
      email: 'paciente@test.com',
    });
    contactFinancialProfileRepository.findByTenantAndContact.mockResolvedValue({
      asaasCustomerId: 'cus_existing',
    });
    paymentService.createPayment.mockResolvedValue({
      id: 'pay_3',
      status: 'PENDING',
      value: 150,
      billingType: 'PIX',
      dueDate: '2026-04-10',
      invoiceUrl: 'https://pay.test/pay_3',
    });
    salesRepository.createPaymentLink.mockImplementation(
      async (record: any) => ({
        ...record,
        createdAt: new Date('2026-03-31T00:00:00.000Z'),
        updatedAt: new Date('2026-03-31T00:00:00.000Z'),
      }),
    );

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      contactId: 'contact-1',
      name: 'Tratamento recorrente',
      value: 150,
      billingType: 'PIX',
      dueDate: new Date('2026-04-10T23:59:59.000Z'),
      recurrence: {
        frequency: 'MONTHLY',
        startDate: new Date('2026-04-10T00:00:00.000Z'),
        endDate: new Date('2026-06-10T23:59:59.000Z'),
      },
    });

    expect(salesRepository.createPaymentLink).toHaveBeenCalledWith(
      expect.objectContaining({
        recurrenceEnabled: true,
        recurrenceFrequency: 'MONTHLY',
        recurrenceTotalValue: 450,
        recurrenceNextRunAt: new Date('2026-05-10T00:00:00.000Z'),
      }),
    );
    expect(result.recurrence).toEqual(
      expect.objectContaining({
        frequency: 'MONTHLY',
        totalValue: 450,
      }),
    );
  });
});
