import { NotFoundException } from '@nestjs/common';
import { CreatePaymentLinkUseCase } from '../application/use-cases/CreatePaymentLinkUseCase';
import { IPaymentFacade } from '../../payment/application/facades/IPaymentFacade';
import { ITenantRepository } from '../../tenant/domain/repositories/ITenantRepository';
import { IEventBus } from '@shared/application/ports/IEventBus';
import { SalesPaymentLinkCreatedIntegrationEvent } from '../application/integration-events/SalesIntegrationEvents';
import { SalesPaymentLinkLifecycleService } from '../application/services/SalesPaymentLinkLifecycleService';

describe('CreatePaymentLinkUseCase', () => {
  let useCase: CreatePaymentLinkUseCase;
  let paymentFacade: jest.Mocked<IPaymentFacade>;
  let tenantRepository: jest.Mocked<ITenantRepository>;
  let salesRepository: any;
  let eventBus: jest.Mocked<IEventBus>;
  let paymentLinkLifecycleService: SalesPaymentLinkLifecycleService;
  let structuredLog: { emit: jest.Mock };

  beforeEach(() => {
    paymentFacade = {
      createCustomer: jest.fn(),
      getCustomer: jest.fn(),
      createSubaccount: jest.fn(),
      listSubaccounts: jest.fn(),
      createSubscription: jest.fn(),
      updateSubscription: jest.fn(),
      cancelSubscription: jest.fn(),
      getSubscription: jest.fn(),
      createPayment: jest.fn(),
      deletePayment: jest.fn(),
      restorePayment: jest.fn(),
      createPaymentLink: jest.fn(),
      removePaymentLink: jest.fn(),
      restorePaymentLink: jest.fn(),
    };

    tenantRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findByCnpj: jest.fn(),
      findByWhatsAppNumber: jest.fn(),
      findByApiKey: jest.fn(),
      findAll: jest.fn(),
      exists: jest.fn(),
      listBranches: jest.fn(),
      createBranch: jest.fn(),
      updateBranch: jest.fn(),
      deleteBranch: jest.fn(),
    };

    salesRepository = {
      findByTenantAndDate: jest.fn(),
      save: jest.fn(),
      incrementMetric: jest.fn(),
      getMetrics: jest.fn(),
      createPaymentLink: jest.fn(),
      listPaymentLinks: jest.fn(),
      findPaymentLinkById: jest.fn(),
      updatePaymentLinkStatus: jest.fn(),
      updatePaymentLinkStatusByExternalReference: jest.fn(),
    };
    eventBus = {
      publish: jest.fn(),
      subscribe: jest.fn(),
    } as any;
    structuredLog = { emit: jest.fn() };
    paymentLinkLifecycleService = new SalesPaymentLinkLifecycleService(
      salesRepository,
      salesRepository,
      eventBus,
    );

    useCase = new CreatePaymentLinkUseCase(
      paymentFacade,
      tenantRepository,
      paymentLinkLifecycleService,
      structuredLog as any,
    );
  });

  it('should throw NotFoundException when the tenant does not exist', async () => {
    tenantRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({
        tenantId: 'missing-tenant',
        name: 'Plano Premium',
        description: 'Assinatura mensal',
        value: 199,
        billingType: 'UNDEFINED',
      }),
    ).rejects.toThrow(NotFoundException);

    expect(paymentFacade.createPaymentLink).not.toHaveBeenCalled();
    expect(salesRepository.incrementMetric).not.toHaveBeenCalled();
  });

  it('should create the payment link and increment LINK revenue', async () => {
    tenantRepository.findById.mockResolvedValue({ id: 'tenant-1' } as any);
    paymentFacade.createPaymentLink.mockResolvedValue({
      id: 'link-123',
      url: 'https://pay.example/link-123',
    });
    salesRepository.createPaymentLink.mockImplementation(
      async (record: any) => ({
        ...record,
        createdAt: new Date('2026-03-31T00:00:00.000Z'),
        updatedAt: new Date('2026-03-31T00:00:00.000Z'),
      }),
    );
    salesRepository.incrementMetric.mockResolvedValue();

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      name: 'Plano Premium',
      description: 'Assinatura mensal',
      value: 199,
      billingType: 'PIX',
    });

    expect(paymentFacade.createPaymentLink).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Plano Premium',
        description: 'Assinatura mensal',
        value: 199,
        billingType: 'PIX',
        chargeType: 'DETACHED',
        dueDateLimitDays: 3,
      }),
    );
    expect(salesRepository.createPaymentLink).toHaveBeenCalledWith(
      expect.objectContaining({
        branchId: null,
        providerLinkId: 'link-123',
        name: 'Plano Premium',
        status: 'ACTIVE',
        source: 'MANUAL',
      }),
    );
    expect(salesRepository.incrementMetric).toHaveBeenCalledWith(
      'tenant-1',
      expect.any(Date),
      'LINK',
      199,
    );
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.any(SalesPaymentLinkCreatedIntegrationEvent),
    );
    expect(structuredLog.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'sales.payment_link.created',
        tenantId: 'tenant-1',
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        url: 'https://pay.example/link-123',
        name: 'Plano Premium',
        value: 199,
        status: 'ACTIVE',
        source: 'MANUAL',
      }),
    );
  });

  it('should preserve UNDEFINED billing type when creating the link', async () => {
    tenantRepository.findById.mockResolvedValue({ id: 'tenant-1' } as any);
    paymentFacade.createPaymentLink.mockResolvedValue({
      id: 'link-undefined',
      url: 'https://pay.example/link-undefined',
    });
    salesRepository.createPaymentLink.mockImplementation(
      async (record: any) => ({
        ...record,
        createdAt: new Date('2026-03-31T00:00:00.000Z'),
        updatedAt: new Date('2026-03-31T00:00:00.000Z'),
      }),
    );
    salesRepository.incrementMetric.mockResolvedValue();

    await useCase.execute({
      tenantId: 'tenant-1',
      name: 'Plano Flex',
      description: 'Pagamento em aberto',
      value: 99,
      billingType: 'UNDEFINED',
    });

    expect(paymentFacade.createPaymentLink).toHaveBeenCalledWith(
      expect.objectContaining({
        billingType: 'UNDEFINED',
        dueDateLimitDays: 3,
      }),
    );
  });

  it('should calculate dueDateLimitDays from the chosen expiration date', async () => {
    tenantRepository.findById.mockResolvedValue({ id: 'tenant-1' } as any);
    paymentFacade.createPaymentLink.mockResolvedValue({
      id: 'link-expiration',
      url: 'https://pay.example/link-expiration',
    });
    salesRepository.createPaymentLink.mockImplementation(
      async (record: any) => ({
        ...record,
        createdAt: new Date('2026-03-31T00:00:00.000Z'),
        updatedAt: new Date('2026-03-31T00:00:00.000Z'),
      }),
    );
    salesRepository.incrementMetric.mockResolvedValue();

    const RealDate = Date;
    const fixedNow = new RealDate('2026-03-31T12:00:00.000Z');

    global.Date = class extends RealDate {
      constructor(value?: any) {
        if (value !== undefined) {
          super(value);
          return;
        }

        super(fixedNow.toISOString());
      }

      static now() {
        return fixedNow.getTime();
      }
    } as DateConstructor;

    try {
      await useCase.execute({
        tenantId: 'tenant-1',
        name: 'Consulta especial',
        value: 230,
        billingType: 'PIX',
        expiresAt: new RealDate('2026-04-05T23:59:59.000Z'),
      });
    } finally {
      global.Date = RealDate;
    }

    expect(paymentFacade.createPaymentLink).toHaveBeenCalledWith(
      expect.objectContaining({
        dueDateLimitDays: 5,
      }),
    );
  });

  it('should persist branchId when the link is created from a branch scope', async () => {
    tenantRepository.findById.mockResolvedValue({ id: 'tenant-1' } as any);
    paymentFacade.createPaymentLink.mockResolvedValue({
      id: 'link-branch',
      url: 'https://pay.example/link-branch',
    });
    salesRepository.createPaymentLink.mockImplementation(
      async (record: any) => ({
        ...record,
        createdAt: new Date('2026-03-31T00:00:00.000Z'),
        updatedAt: new Date('2026-03-31T00:00:00.000Z'),
      }),
    );
    salesRepository.incrementMetric.mockResolvedValue();

    await useCase.execute({
      tenantId: 'tenant-1',
      branchId: 'branch-1',
      name: 'Plano Unidade Centro',
      value: 149,
      billingType: 'PIX',
    });

    expect(salesRepository.createPaymentLink).toHaveBeenCalledWith(
      expect.objectContaining({
        branchId: 'branch-1',
      }),
    );
  });

  it('should create and persist a recurrent payment link contract', async () => {
    tenantRepository.findById.mockResolvedValue({ id: 'tenant-1' } as any);
    paymentFacade.createPaymentLink.mockResolvedValue({
      id: 'link-recurring',
      url: 'https://pay.example/link-recurring',
    });
    salesRepository.createPaymentLink.mockImplementation(
      async (record: any) => ({
        ...record,
        createdAt: new Date('2026-03-31T00:00:00.000Z'),
        updatedAt: new Date('2026-03-31T00:00:00.000Z'),
      }),
    );
    salesRepository.incrementMetric.mockResolvedValue();

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      name: 'Plano mensal',
      value: 100,
      billingType: 'PIX',
      recurrence: {
        frequency: 'MONTHLY',
        startDate: new Date('2026-04-10T00:00:00.000Z'),
        endDate: new Date('2026-06-10T23:59:59.000Z'),
      },
    });

    expect(paymentFacade.createPaymentLink).toHaveBeenCalledWith(
      expect.objectContaining({
        chargeType: 'RECURRENT',
      }),
    );
    expect(salesRepository.createPaymentLink).toHaveBeenCalledWith(
      expect.objectContaining({
        recurrenceEnabled: true,
        recurrenceFrequency: 'MONTHLY',
        recurrenceTotalValue: 300,
        recurrenceNextRunAt: new Date('2026-05-10T00:00:00.000Z'),
      }),
    );
    expect(result.recurrence).toEqual(
      expect.objectContaining({
        frequency: 'MONTHLY',
        totalValue: 300,
      }),
    );
  });
});
