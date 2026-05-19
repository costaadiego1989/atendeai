import { GetSubscriptionCatalogUseCase } from '../application/use-cases/GetSubscriptionCatalogUseCase';
import { Subscription } from '../domain/entities/Subscription';
import { TenantId } from '@shared/domain/TenantId';

describe('GetSubscriptionCatalogUseCase', () => {
  let useCase: GetSubscriptionCatalogUseCase;
  let billingRepo: any;
  let prisma: any;
  let tenantModuleAccessService: any;

  const mockSubscription = Subscription.create(
    TenantId.create('tenant-1'),
    'PROFISSIONAL',
  );

  const mockModules = [
    {
      code: 'prospecting',
      displayName: 'Prospecção',
      description: 'Módulo de prospecção',
      category: 'SALES',
      billingMode: 'ADDON',
      monthlyPrice: 49,
      pricingVersion: 'v1',
      salesPitch: 'Aumente suas vendas',
      quotaImpact: {},
      includedInPlans: ['ESCALA'],
      config: {},
      active: true,
    },
    {
      code: 'recovery',
      displayName: 'Recuperação',
      description: 'Módulo de recuperação',
      category: 'RETENTION',
      billingMode: 'ADDON',
      monthlyPrice: 39,
      pricingVersion: 'v1',
      salesPitch: null,
      quotaImpact: {},
      includedInPlans: [],
      config: {},
      active: true,
    },
    {
      code: 'crm',
      displayName: 'CRM',
      description: 'CRM integrado',
      category: 'CORE',
      billingMode: 'INCLUDED',
      monthlyPrice: 0,
      pricingVersion: null,
      salesPitch: null,
      quotaImpact: {},
      includedInPlans: ['ESSENCIAL', 'PROFISSIONAL', 'ESCALA'],
      config: {},
      active: true,
    },
  ];

  const mockNiches = [
    {
      code: 'FOOD',
      displayName: 'Alimentação',
      description: 'Nicho alimentação',
      pains: ['Gestão de pedidos', 'Delivery'],
      iconName: 'food',
      active: true,
      modules: ['recovery'],
      recommendations: [
        {
          moduleCode: 'recovery',
          isRecommended: true,
          isPrimary: true,
          marketingHeadline: 'Recupere clientes',
          salesPitch: 'Ideal para food',
          sortOrder: 1,
        },
      ],
    },
  ];

  beforeEach(() => {
    billingRepo = {
      findSubscription: jest.fn().mockResolvedValue(mockSubscription),
      listModules: jest.fn().mockResolvedValue(mockModules),
      listNiches: jest.fn().mockResolvedValue(mockNiches),
    };
    prisma = {
      tenant: {
        findUnique: jest.fn().mockResolvedValue({ businessType: 'BAKERY' }),
      },
    };
    tenantModuleAccessService = {
      getSummary: jest.fn().mockResolvedValue({
        subscriptionId: 'sub-1',
        plan: 'PROFISSIONAL',
        status: 'ACTIVE',
        pricing: {
          baseMonthlyPrice: 297,
          addonsMonthlyPrice: 49,
          totalMonthlyPrice: 346,
          pricingVersion: 'v1',
        },
        includedModules: ['crm'],
        addonModules: ['prospecting'],
        enabledModules: ['crm', 'prospecting'],
        moduleAccess: { crm: true, prospecting: true },
      }),
    };

    useCase = new GetSubscriptionCatalogUseCase(
      billingRepo,
      prisma,
      tenantModuleAccessService,
    );
  });

  describe('returns catalog with all plans', () => {
    it('should return catalog with subscription info and available addons', async () => {
      const result = await useCase.execute({ tenantId: 'tenant-1' });

      expect(result.tenantId).toBe('tenant-1');
      expect(result.subscription).toBeDefined();
      expect(result.subscription.plan).toBe('PROFISSIONAL');
      expect(result.availableAddons).toBeDefined();
      expect(result.availableAddons.length).toBeGreaterThan(0);
    });
  });

  describe('includes modules per plan', () => {
    it('should only include ADDON modules in availableAddons', async () => {
      const result = await useCase.execute({ tenantId: 'tenant-1' });

      const addonCodes = result.availableAddons.map((a) => a.code);
      expect(addonCodes).toContain('prospecting');
      expect(addonCodes).toContain('recovery');
      expect(addonCodes).not.toContain('crm'); // INCLUDED, not ADDON
    });
  });

  describe('includes pricing', () => {
    it('should include monthly price for each addon', async () => {
      const result = await useCase.execute({ tenantId: 'tenant-1' });

      const prospecting = result.availableAddons.find(
        (a) => a.code === 'prospecting',
      );
      expect(prospecting?.monthlyPrice).toBe(49);

      const recovery = result.availableAddons.find(
        (a) => a.code === 'recovery',
      );
      expect(recovery?.monthlyPrice).toBe(39);
    });
  });

  describe('filters by niche if provided', () => {
    it('should resolve niche from businessType and include recommendations', async () => {
      const result = await useCase.execute({ tenantId: 'tenant-1' });

      expect(result.niche).not.toBeNull();
      expect(result.niche?.code).toBe('FOOD');
      expect(result.niche?.pains).toContain('Gestão de pedidos');

      const recovery = result.availableAddons.find(
        (a) => a.code === 'recovery',
      );
      expect(recovery?.recommended).toBe(true);
      expect(recovery?.primaryRecommendation).toBe(true);
      expect(recovery?.marketingHeadline).toBe('Recupere clientes');
    });

    it('should return null niche when businessType is not set', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);

      const result = await useCase.execute({ tenantId: 'tenant-1' });

      expect(result.niche).toBeNull();
      expect(result.businessType).toBeNull();
    });
  });

  describe('when subscription does not exist', () => {
    it('should return catalog with null subscription info and available addons', async () => {
      billingRepo.findSubscription.mockResolvedValue(null);

      const result = await useCase.execute({ tenantId: 'tenant-missing' });

      expect(result.tenantId).toBe('tenant-missing');
      expect(result.subscription).toBeDefined();
      expect(result.availableAddons.length).toBeGreaterThan(0);
      // All addons should be selectable and not subscribed
      for (const addon of result.availableAddons) {
        expect(addon.subscribed).toBe(false);
        expect(addon.includedInPlan).toBe(false);
        expect(addon.selectable).toBe(true);
      }
    });
  });
});
