import { CancelSubscriptionUseCase } from '../application/use-cases/CancelSubscriptionUseCase';
import { Subscription } from '../domain/entities/Subscription';
import { TenantId } from '../../../shared/domain/TenantId';

describe('CancelSubscriptionUseCase', () => {
  let useCase: CancelSubscriptionUseCase;
  let billingRepository: any;
  let tenantQueryPort: any;
  let paymentPort: any;

  beforeEach(() => {
    billingRepository = {
      findSubscription: jest.fn(),
      saveSubscription: jest.fn(),
      replaceSubscriptionModules: jest.fn().mockResolvedValue(undefined),
      findPlanByCode: jest.fn().mockResolvedValue(null),
    };
    tenantQueryPort = {
      findTenantById: jest.fn(),
      findTenantPlan: jest.fn(),
      updateTenantPlan: jest.fn(),
    };
    paymentPort = {
      cancelSubscription: jest.fn(),
      createCustomer: jest.fn(),
      createSubscription: jest.fn(),
      updateSubscription: jest.fn(),
      createPaymentLink: jest.fn(),
    };

    useCase = new CancelSubscriptionUseCase(
      billingRepository,
      tenantQueryPort,
      paymentPort,
    );
  });

  it('should cancel a remote subscription and downgrade to ESSENCIAL immediately', async () => {
    const subscription = Subscription.create(
      TenantId.create('tenant-1'),
      'PROFISSIONAL',
    );
    subscription.updateAsaasInfo('cus_123', 'sub_123');

    billingRepository.findSubscription.mockResolvedValue(subscription);
    paymentPort.cancelSubscription.mockResolvedValue(undefined);

    const result = await useCase.execute({ tenantId: 'tenant-1' });

    expect(paymentPort.cancelSubscription).toHaveBeenCalledWith('sub_123');
    expect(subscription.plan).toBe('ESSENCIAL');
    expect(subscription.status).toBe('ACTIVE');
    expect(subscription.asaasSubscriptionId).toBeUndefined();
    expect(subscription.scheduledPlan).toBeUndefined();
    expect(tenantQueryPort.updateTenantPlan).toHaveBeenCalledWith('tenant-1', 'ESSENCIAL');
    expect(result.status).toBe('ACTIVE');
    expect(billingRepository.saveSubscription).toHaveBeenCalled();
  });

  it('should downgrade a local subscription without remote cancellation call', async () => {
    const subscription = Subscription.create(
      TenantId.create('tenant-1'),
      'PROFISSIONAL',
    );

    billingRepository.findSubscription.mockResolvedValue(subscription);

    const result = await useCase.execute({ tenantId: 'tenant-1' });

    expect(paymentPort.cancelSubscription).not.toHaveBeenCalled();
    expect(subscription.plan).toBe('ESSENCIAL');
    expect(subscription.status).toBe('ACTIVE');
    expect(tenantQueryPort.updateTenantPlan).toHaveBeenCalledWith('tenant-1', 'ESSENCIAL');
    expect(result.status).toBe('ACTIVE');
  });
});
