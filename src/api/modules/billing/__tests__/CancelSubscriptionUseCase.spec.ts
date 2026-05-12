import { CancelSubscriptionUseCase } from '../application/use-cases/CancelSubscriptionUseCase';
import { Subscription } from '../domain/entities/Subscription';
import { TenantId } from '../../../shared/domain/TenantId';
import { Tenant } from '../../tenant/domain/entities/Tenant';
import { CompanyName } from '../../tenant/domain/value-objects/CompanyName';
import { CNPJ } from '../../tenant/domain/value-objects/CNPJ';
import { Plan } from '../../tenant/domain/value-objects/Plan';
import { User } from '../../tenant/domain/entities/User';
import { Email } from '../../tenant/domain/value-objects/Email';
import { Phone } from '../../tenant/domain/value-objects/Phone';
import { Role } from '../../tenant/domain/value-objects/Role';

describe('CancelSubscriptionUseCase', () => {
  let useCase: CancelSubscriptionUseCase;
  let billingRepository: any;
  let tenantRepository: any;
  let paymentService: any;

  function createTenantWithPlan(plan: 'ESSENCIAL' | 'PROFISSIONAL' | 'ESCALA') {
    return Tenant.create(
      {
        companyName: CompanyName.create('Empresa Teste'),
        cnpj: CNPJ.create('11.444.777/0001-61'),
        plan: Plan.create(plan),
        users: [
          User.create({
            name: 'Owner Teste',
            email: Email.create('owner@test.com'),
            phone: Phone.create('11999999999'),
            passwordHash: 'hash',
            role: Role.create('OWNER'),
          }),
        ],
      },
      undefined,
    );
  }

  beforeEach(() => {
    billingRepository = {
      findSubscription: jest.fn(),
      saveSubscription: jest.fn(),
      replaceSubscriptionModules: jest.fn().mockResolvedValue(undefined),
      findPlanByCode: jest.fn().mockResolvedValue(null),
    };
    tenantRepository = {
      findById: jest.fn(),
      save: jest.fn(),
    };
    paymentService = {
      cancelSubscription: jest.fn(),
    };

    useCase = new CancelSubscriptionUseCase(
      billingRepository,
      tenantRepository,
      paymentService,
    );
  });

  it('should cancel a remote subscription and downgrade to ESSENCIAL immediately', async () => {
    const subscription = Subscription.create(TenantId.create('tenant-1'), 'PROFISSIONAL');
    subscription.updateAsaasInfo('cus_123', 'sub_123');
    const tenant = createTenantWithPlan('PROFISSIONAL');

    billingRepository.findSubscription.mockResolvedValue(subscription);
    tenantRepository.findById.mockResolvedValue(tenant);
    paymentService.cancelSubscription.mockResolvedValue({
      id: 'sub_123',
      status: 'REMOVED',
      value: 99,
      billingType: 'CREDIT_CARD',
      nextDueDate: '2030-01-01',
    });

    const result = await useCase.execute({ tenantId: 'tenant-1' });

    expect(paymentService.cancelSubscription).toHaveBeenCalledWith('sub_123');
    expect(subscription.plan).toBe('ESSENCIAL');
    expect(subscription.status).toBe('ACTIVE');
    expect(subscription.asaasSubscriptionId).toBeUndefined();
    expect(subscription.scheduledPlan).toBeUndefined();
    expect(tenant.plan.value).toBe('ESSENCIAL');
    expect(tenantRepository.save).toHaveBeenCalledWith(tenant);
    expect(result.status).toBe('ACTIVE');
    expect(billingRepository.saveSubscription).toHaveBeenCalled();
  });

  it('should downgrade a local subscription without remote cancellation call', async () => {
    const subscription = Subscription.create(TenantId.create('tenant-1'), 'PROFISSIONAL');
    const tenant = createTenantWithPlan('PROFISSIONAL');

    billingRepository.findSubscription.mockResolvedValue(subscription);
    tenantRepository.findById.mockResolvedValue(tenant);

    const result = await useCase.execute({ tenantId: 'tenant-1' });

    expect(paymentService.cancelSubscription).not.toHaveBeenCalled();
    expect(subscription.plan).toBe('ESSENCIAL');
    expect(subscription.status).toBe('ACTIVE');
    expect(tenant.plan.value).toBe('ESSENCIAL');
    expect(result.status).toBe('ACTIVE');
  });
});
