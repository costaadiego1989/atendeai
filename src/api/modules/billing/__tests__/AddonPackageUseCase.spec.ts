import { PurchaseAddonPackageUseCase } from '../application/use-cases/PurchaseAddonPackageUseCase';
import { CancelAddonPackageUseCase } from '../application/use-cases/CancelAddonPackageUseCase';
import { GetAddonPackageInfoUseCase } from '../application/use-cases/GetAddonPackageInfoUseCase';
import { Subscription } from '../domain/entities/Subscription';
import { TenantId } from '../../../shared/domain/TenantId';
import { ADDON_PACKAGE_MODULE_CODE } from '../domain/constants/AddonPackages';
import { PLAN_QUOTAS } from '../domain/constants/PlanQuotas';

describe('PurchaseAddonPackageUseCase', () => {
  let useCase: PurchaseAddonPackageUseCase;
  let billingRepo: any;
  let tenantRepo: any;
  let paymentService: any;

  beforeEach(() => {
    billingRepo = {
      findSubscription: jest.fn(),
      findPlanByCode: jest.fn(),
      findActiveSubscriptionModule: jest.fn(),
      saveSubscription: jest.fn(),
      saveSubscriptionModule: jest.fn(),
      saveAuditLog: jest.fn(),
    };
    tenantRepo = { findById: jest.fn() };
    paymentService = {
      createPaymentLink: jest.fn().mockResolvedValue({
        id: 'link-1',
        url: 'https://checkout.example.com/addon',
      }),
      createCustomer: jest.fn(),
    };
    useCase = new PurchaseAddonPackageUseCase(
      billingRepo,
      tenantRepo,
      paymentService,
    );
  });

  it('3.1 should adjust quotas with correct deltas on purchase', async () => {
    const sub = Subscription.create(TenantId.create('t1'), 'PROFISSIONAL');
    sub.activate();
    sub.updateAsaasCustomer('cus_existing');
    billingRepo.findSubscription.mockResolvedValue(sub);
    billingRepo.findActiveSubscriptionModule.mockResolvedValue(null);
    billingRepo.findPlanByCode.mockResolvedValue({
      code: 'PROFISSIONAL',
      monthlyPrice: 19700,
      messagesQuota: 75000,
      aiTokensQuota: 7500000,
      contactsQuota: 2500,
    });

    const originalMessages = sub.quotas.messages;
    const originalAiTokens = sub.quotas.aiTokens;
    const originalContacts = sub.quotas.contacts;

    const result = await useCase.execute({ tenantId: 't1' });

    // Quotas should be increased by half of plan quotas
    const expectedMessages = Math.floor(PLAN_QUOTAS.PROFISSIONAL.messages / 2);
    const expectedAiTokens = Math.floor(PLAN_QUOTAS.PROFISSIONAL.aiTokens / 2);
    const expectedContacts = Math.floor(PLAN_QUOTAS.PROFISSIONAL.contacts / 2);

    expect(sub.quotas.messages).toBe(originalMessages + expectedMessages);
    expect(sub.quotas.aiTokens).toBe(originalAiTokens + expectedAiTokens);
    expect(sub.quotas.contacts).toBe(originalContacts + expectedContacts);

    expect(result.package.messages).toBe(expectedMessages);
    expect(result.package.aiTokens).toBe(expectedAiTokens);
    expect(result.package.contacts).toBe(expectedContacts);
  });

  it('3.2 should calculate price as 50% of plan monthly price', async () => {
    const sub = Subscription.create(TenantId.create('t1'), 'PROFISSIONAL');
    sub.activate();
    sub.updateAsaasCustomer('cus_existing');
    billingRepo.findSubscription.mockResolvedValue(sub);
    billingRepo.findActiveSubscriptionModule.mockResolvedValue(null);
    billingRepo.findPlanByCode.mockResolvedValue({
      code: 'PROFISSIONAL',
      monthlyPrice: 19700,
    });

    const result = await useCase.execute({ tenantId: 't1' });

    expect(result.package.price).toBe(Math.round(19700 * 0.5));
    expect(result.mode).toBe('CHECKOUT_REQUIRED');
    expect(result.checkoutUrl).toBe('https://checkout.example.com/addon');
  });

  it('3.3 should reject purchase for TRIAL plan', async () => {
    const sub = Subscription.create(TenantId.create('t1'), 'TRIAL');
    billingRepo.findSubscription.mockResolvedValue(sub);

    await expect(useCase.execute({ tenantId: 't1' })).rejects.toThrow(
      /Trial/,
    );
  });

  it('3.4 should reject if addon package already active', async () => {
    const sub = Subscription.create(TenantId.create('t1'), 'ESSENCIAL');
    sub.activate();
    billingRepo.findSubscription.mockResolvedValue(sub);
    billingRepo.findActiveSubscriptionModule.mockResolvedValue({
      moduleCode: ADDON_PACKAGE_MODULE_CODE,
      status: 'ACTIVE',
      monthlyPrice: 4850,
      quotaImpact: { messages: 7500, aiTokens: 750000, contacts: 250 },
    });

    await expect(useCase.execute({ tenantId: 't1' })).rejects.toThrow(
      /pacote adicional ativo/,
    );
  });

  it('3.6 should save audit log on purchase', async () => {
    const sub = Subscription.create(TenantId.create('t1'), 'ESSENCIAL');
    sub.activate();
    sub.updateAsaasCustomer('cus_existing');
    billingRepo.findSubscription.mockResolvedValue(sub);
    billingRepo.findActiveSubscriptionModule.mockResolvedValue(null);
    billingRepo.findPlanByCode.mockResolvedValue({
      code: 'ESSENCIAL',
      monthlyPrice: 9700,
    });

    await useCase.execute({ tenantId: 't1' });

    expect(billingRepo.saveAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 't1',
        event: 'ADDON_PACKAGE_PURCHASED',
      }),
    );
  });
});

describe('CancelAddonPackageUseCase', () => {
  let useCase: CancelAddonPackageUseCase;
  let billingRepo: any;

  beforeEach(() => {
    billingRepo = {
      findSubscription: jest.fn(),
      findActiveSubscriptionModule: jest.fn(),
      saveSubscription: jest.fn(),
      updateSubscriptionModuleStatus: jest.fn(),
      saveAuditLog: jest.fn(),
    };
    useCase = new CancelAddonPackageUseCase(billingRepo);
  });

  it('3.5 should revert quotas on cancel', async () => {
    const sub = Subscription.create(TenantId.create('t1'), 'PROFISSIONAL');
    sub.activate();
    // Simulate that quotas were already boosted
    sub.adjustQuotas({ messages: 37500, aiTokens: 3750000, contacts: 1250 });
    const boostedMessages = sub.quotas.messages;

    billingRepo.findSubscription.mockResolvedValue(sub);
    billingRepo.findActiveSubscriptionModule.mockResolvedValue({
      moduleCode: ADDON_PACKAGE_MODULE_CODE,
      status: 'ACTIVE',
      monthlyPrice: 9850,
      quotaImpact: { messages: 37500, aiTokens: 3750000, contacts: 1250 },
      metadata: { oneShot: true },
    });

    const result = await useCase.execute({ tenantId: 't1' });

    expect(result.status).toBe('CANCELED');
    expect(sub.quotas.messages).toBe(boostedMessages - 37500);
    expect(billingRepo.updateSubscriptionModuleStatus).toHaveBeenCalledWith(
      't1',
      ADDON_PACKAGE_MODULE_CODE,
      'CANCELED',
      expect.any(Date),
    );
  });

  it('should throw if no active addon package', async () => {
    const sub = Subscription.create(TenantId.create('t1'), 'PROFISSIONAL');
    billingRepo.findSubscription.mockResolvedValue(sub);
    billingRepo.findActiveSubscriptionModule.mockResolvedValue(null);

    await expect(useCase.execute({ tenantId: 't1' })).rejects.toThrow();
  });
});

describe('GetAddonPackageInfoUseCase', () => {
  let useCase: GetAddonPackageInfoUseCase;
  let billingRepo: any;

  beforeEach(() => {
    billingRepo = {
      findSubscription: jest.fn(),
      findActiveSubscriptionModule: jest.fn(),
      findPlanByCode: jest.fn(),
    };
    useCase = new GetAddonPackageInfoUseCase(billingRepo);
  });

  it('should return available=false for TRIAL', async () => {
    const sub = Subscription.create(TenantId.create('t1'), 'TRIAL');
    billingRepo.findSubscription.mockResolvedValue(sub);

    const result = await useCase.execute({ tenantId: 't1' });

    expect(result.available).toBe(false);
    expect(result.package).toBeNull();
  });

  it('should return package info with correct price for paid plan', async () => {
    const sub = Subscription.create(TenantId.create('t1'), 'ESCALA');
    billingRepo.findSubscription.mockResolvedValue(sub);
    billingRepo.findActiveSubscriptionModule.mockResolvedValue(null);
    billingRepo.findPlanByCode.mockResolvedValue({
      code: 'ESCALA',
      monthlyPrice: 49700,
    });

    const result = await useCase.execute({ tenantId: 't1' });

    expect(result.available).toBe(true);
    expect(result.active).toBe(false);
    expect(result.package).not.toBeNull();
    expect(result.package!.price).toBe(Math.round(49700 * 0.5));
    expect(result.package!.messages).toBe(Math.floor(PLAN_QUOTAS.ESCALA.messages / 2));
  });

  it('should return active=true when addon is active', async () => {
    const sub = Subscription.create(TenantId.create('t1'), 'ESSENCIAL');
    billingRepo.findSubscription.mockResolvedValue(sub);
    billingRepo.findActiveSubscriptionModule.mockResolvedValue({
      moduleCode: ADDON_PACKAGE_MODULE_CODE,
      status: 'ACTIVE',
    });
    billingRepo.findPlanByCode.mockResolvedValue({
      code: 'ESSENCIAL',
      monthlyPrice: 9700,
    });

    const result = await useCase.execute({ tenantId: 't1' });

    expect(result.active).toBe(true);
  });
});
