import { ChangeSubscriptionPlanUseCase } from '../application/use-cases/ChangeSubscriptionPlanUseCase';
import { Subscription } from '../domain/entities/Subscription';
import { TenantId } from '../../../shared/domain/TenantId';

describe('ChangeSubscriptionPlanUseCase', () => {
  let useCase: ChangeSubscriptionPlanUseCase;
  let billingRepository: any;
  let paymentPort: any;
  let ensureCustomerService: any;
  let configService: any;
  let planChangeQueue: any;

  beforeEach(() => {
    billingRepository = {
      findSubscription: jest.fn(),
      saveSubscription: jest.fn(),
      findPlanByCode: jest.fn(),
      listSubscriptionModules: jest.fn().mockResolvedValue([]),
    };
    paymentPort = {
      updateSubscription: jest.fn(),
      cancelSubscription: jest.fn(),
      createCustomer: jest.fn(),
      createSubscription: jest.fn(),
      createPaymentLink: jest.fn(),
    };
    ensureCustomerService = {
      ensure: jest.fn(),
    };
    configService = {
      get: jest.fn().mockReturnValue('0'),
    };
    planChangeQueue = {
      add: jest.fn(),
    };

    useCase = new ChangeSubscriptionPlanUseCase(
      billingRepository,
      paymentPort,
      ensureCustomerService,
      configService,
      planChangeQueue,
    );
  });

  it('should require immediate checkout for upgrades without changing the plan immediately', async () => {
    const subscription = Subscription.create(
      TenantId.create('tenant-1'),
      'ESSENCIAL',
    );

    billingRepository.findSubscription.mockResolvedValue(subscription);
    ensureCustomerService.ensure.mockResolvedValue('cus_123');
    billingRepository.findPlanByCode.mockResolvedValue({
      code: 'PROFISSIONAL',
      displayName: 'Profissional',
      monthlyPrice: 297,
    });
    paymentPort.createPaymentLink.mockResolvedValue({
      id: 'plink_123',
      url: 'https://pay.asaas.com/link/plink_123',
    });

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      targetPlan: 'PROFISSIONAL',
    });

    expect(ensureCustomerService.ensure).toHaveBeenCalled();
    expect(paymentPort.createPaymentLink).toHaveBeenCalledWith(
      expect.objectContaining({
        externalReference: 'billing-upgrade|tenant-1|PROFISSIONAL|MONTHLY',
      }),
    );
    expect(result.mode).toBe('CHECKOUT_REQUIRED');
    expect(result.checkoutUrl).toBe('https://pay.asaas.com/link/plink_123');
    expect(result.plan).toBe('ESSENCIAL');
    expect(subscription.plan).toBe('ESSENCIAL');
  });

  it('should schedule downgrade to ESSENCIAL and queue local application for cycle end', async () => {
    const subscription = Subscription.create(
      TenantId.create('tenant-1'),
      'PROFISSIONAL',
    );
    subscription.updateAsaasInfo('cus_123', 'sub_123');

    billingRepository.findSubscription.mockResolvedValue(subscription);
    paymentPort.cancelSubscription.mockResolvedValue(undefined);

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      targetPlan: 'ESSENCIAL',
    });

    expect(paymentPort.cancelSubscription).toHaveBeenCalledWith('sub_123');
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
    const subscription = Subscription.create(
      TenantId.create('tenant-1'),
      'ESCALA',
    );
    subscription.updateAsaasInfo('cus_123', 'sub_123');

    billingRepository.findSubscription.mockResolvedValue(subscription);
    billingRepository.findPlanByCode.mockResolvedValue({
      code: 'PROFISSIONAL',
      displayName: 'Profissional',
      monthlyPrice: 297,
    });
    paymentPort.updateSubscription.mockResolvedValue(undefined);

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      targetPlan: 'PROFISSIONAL',
    });

    expect(paymentPort.updateSubscription).toHaveBeenCalledWith(
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
