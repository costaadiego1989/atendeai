import { ChangeSubscriptionPlanUseCase } from '../application/use-cases/ChangeSubscriptionPlanUseCase';
import { Subscription } from '../domain/entities/Subscription';
import { TenantId } from '../../../shared/domain/TenantId';

describe('ChangeSubscriptionPlanUseCase', () => {
  let useCase: ChangeSubscriptionPlanUseCase;
  let billingRepository: any;
  let tenantRepository: any;
  let paymentService: any;
  let planChangeQueue: any;

  beforeEach(() => {
    billingRepository = {
      findSubscription: jest.fn(),
      saveSubscription: jest.fn(),
      findPlanByCode: jest.fn(),
    };
    tenantRepository = {
      findById: jest.fn(),
    };
    paymentService = {
      updateSubscription: jest.fn(),
      cancelSubscription: jest.fn(),
      createCustomer: jest.fn(),
      createSubaccount: jest.fn(),
      createSubscription: jest.fn(),
      createPayment: jest.fn(),
      deletePayment: jest.fn(),
      restorePayment: jest.fn(),
      createPaymentLink: jest.fn(),
    };
    planChangeQueue = {
      add: jest.fn(),
    };

    useCase = new ChangeSubscriptionPlanUseCase(
      billingRepository,
      tenantRepository,
      paymentService,
      planChangeQueue,
    );
  });

  it('should require immediate checkout for upgrades without changing the plan immediately', async () => {
    const subscription = Subscription.create(TenantId.create('tenant-1'), 'ESSENCIAL');

    billingRepository.findSubscription.mockResolvedValue(subscription);
    tenantRepository.findById.mockResolvedValue({
      cnpj: { value: '11.444.777/0001-61' },
      owner: {
        name: 'Owner',
        email: { value: 'owner@test.com' },
        phone: { value: '11999999999' },
      },
    });
    paymentService.createCustomer.mockResolvedValue({
      id: 'cus_123',
    });
    billingRepository.findPlanByCode.mockResolvedValue({
      code: 'PROFISSIONAL',
      displayName: 'Profissional',
      monthlyPrice: 297,
    });
    paymentService.createPaymentLink.mockResolvedValue({
      id: 'plink_123',
      url: 'https://pay.asaas.com/link/plink_123',
    });

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      targetPlan: 'PROFISSIONAL',
    });

    expect(paymentService.createCustomer).toHaveBeenCalled();
    expect(paymentService.createPaymentLink).toHaveBeenCalledWith(
      expect.objectContaining({
        externalReference: 'billing-upgrade|tenant-1|PROFISSIONAL',
      }),
    );
    expect(result.mode).toBe('CHECKOUT_REQUIRED');
    expect(result.checkoutUrl).toBe('https://pay.asaas.com/link/plink_123');
    expect(result.plan).toBe('ESSENCIAL');
    expect(subscription.plan).toBe('ESSENCIAL');
  });

  it('should schedule downgrade to ESSENCIAL and queue local application for cycle end', async () => {
    const subscription = Subscription.create(TenantId.create('tenant-1'), 'PROFISSIONAL');
    subscription.updateAsaasInfo('cus_123', 'sub_123');

    billingRepository.findSubscription.mockResolvedValue(subscription);
    paymentService.cancelSubscription.mockResolvedValue({
      id: 'sub_123',
      status: 'REMOVED',
      value: 99,
      billingType: 'CREDIT_CARD',
      nextDueDate: '2030-01-01',
    });

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      targetPlan: 'ESSENCIAL',
    });

    expect(paymentService.cancelSubscription).toHaveBeenCalledWith('sub_123');
    expect(planChangeQueue.add).toHaveBeenCalledWith(
      'apply-scheduled-plan-change',
      expect.objectContaining({
        tenantId: 'tenant-1',
        targetPlan: 'ESSENCIAL',
      }),
      expect.objectContaining({
        delay: expect.any(Number),
      }),
    );
    expect(result.mode).toBe('DOWNGRADE_SCHEDULED');
    expect(result.plan).toBe('PROFISSIONAL');
    expect(result.targetPlan).toBe('ESSENCIAL');
    expect(subscription.plan).toBe('PROFISSIONAL');
    expect(subscription.scheduledPlan).toBe('ESSENCIAL');
  });

  it('should schedule downgrade between paid plans and update future recurring billing', async () => {
    const subscription = Subscription.create(TenantId.create('tenant-1'), 'ESCALA');
    subscription.updateAsaasInfo('cus_123', 'sub_123');

    billingRepository.findSubscription.mockResolvedValue(subscription);
    billingRepository.findPlanByCode.mockResolvedValue({
      code: 'PROFISSIONAL',
      displayName: 'Profissional',
      monthlyPrice: 297,
    });
    paymentService.updateSubscription.mockResolvedValue({
      id: 'sub_123',
      status: 'ACTIVE',
      value: 199,
      billingType: 'CREDIT_CARD',
      nextDueDate: '2030-01-01',
    });

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      targetPlan: 'PROFISSIONAL',
    });

    expect(paymentService.updateSubscription).toHaveBeenCalledWith(
      'sub_123',
      expect.objectContaining({
        value: expect.any(Number),
        description: 'Plano PROFISSIONAL - AtendeAi',
      }),
    );
    expect(result.mode).toBe('DOWNGRADE_SCHEDULED');
    expect(result.plan).toBe('ESCALA');
    expect(result.targetPlan).toBe('PROFISSIONAL');
    expect(subscription.scheduledPlan).toBe('PROFISSIONAL');
  });
});
