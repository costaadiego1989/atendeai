import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ReplaceSubscriptionModulesUseCase } from '../application/use-cases/ReplaceSubscriptionModulesUseCase';
import { Subscription } from '../domain/entities/Subscription';
import { TenantId } from '@shared/domain/TenantId';

describe('ReplaceSubscriptionModulesUseCase', () => {
  let useCase: ReplaceSubscriptionModulesUseCase;
  let billingRepo: any;
  let tenantModuleAccessService: any;

  const mockModules = [
    {
      code: 'prospecting',
      displayName: 'Prospecção',
      description: 'Módulo de prospecção',
      category: 'SALES',
      billingMode: 'ADDON',
      monthlyPrice: 49,
      pricingVersion: 'v1',
      salesPitch: null,
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
      description: null,
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

  const planDefinition = {
    code: 'PROFISSIONAL',
    displayName: 'Profissional',
    monthlyPrice: 297,
    messagesQuota: 75000,
    aiTokensQuota: 7500000,
    contactsQuota: 2500,
    pricingVersion: 'v1',
    sortOrder: 2,
    active: true,
    features: [],
    isStandard: true,
    config: { modules: { crm: true, inbox: true } },
  };

  beforeEach(() => {
    billingRepo = {
      findSubscription: jest.fn(),
      saveSubscription: jest.fn(),
      findPlanByCode: jest.fn().mockResolvedValue(planDefinition),
      listModules: jest.fn().mockResolvedValue(mockModules),
      listSubscriptionModules: jest.fn().mockResolvedValue([]),
      replaceSubscriptionModules: jest.fn(),
      saveAuditLog: jest.fn(),
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

    useCase = new ReplaceSubscriptionModulesUseCase(
      billingRepo,
      tenantModuleAccessService,
    );
  });

  describe('replace modules successfully', () => {
    it('should replace subscription modules and update pricing', async () => {
      const subscription = Subscription.create(
        TenantId.create('tenant-1'),
        'PROFISSIONAL',
      );
      billingRepo.findSubscription.mockResolvedValue(subscription);

      const result = await useCase.execute({
        tenantId: 'tenant-1',
        moduleCodes: ['prospecting', 'recovery'],
      });

      expect(billingRepo.saveSubscription).toHaveBeenCalledTimes(1);
      expect(billingRepo.replaceSubscriptionModules).toHaveBeenCalledWith(
        subscription.id.toString(),
        'tenant-1',
        expect.arrayContaining([
          expect.objectContaining({ moduleCode: 'prospecting' }),
          expect.objectContaining({ moduleCode: 'recovery' }),
        ]),
      );
      expect(billingRepo.saveAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          event: 'SUBSCRIPTION_MODULES_UPDATED',
        }),
      );
      expect(result.tenantId).toBe('tenant-1');
      expect(result.subscription).toBeDefined();
    });
  });

  describe('validates module list', () => {
    it('should throw BadRequestException for invalid module codes', async () => {
      const subscription = Subscription.create(
        TenantId.create('tenant-2'),
        'PROFISSIONAL',
      );
      billingRepo.findSubscription.mockResolvedValue(subscription);

      await expect(
        useCase.execute({
          tenantId: 'tenant-2',
          moduleCodes: ['invalid-module', 'another-invalid'],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject INCLUDED billing mode modules as invalid addons', async () => {
      const subscription = Subscription.create(
        TenantId.create('tenant-3'),
        'PROFISSIONAL',
      );
      billingRepo.findSubscription.mockResolvedValue(subscription);

      // 'crm' is INCLUDED, not ADDON - should be treated as invalid
      await expect(
        useCase.execute({
          tenantId: 'tenant-3',
          moduleCodes: ['crm'],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('checks plan compatibility', () => {
    it('should exclude modules already included in plan from addon list', async () => {
      const subscription = Subscription.create(
        TenantId.create('tenant-4'),
        'ESCALA',
      );
      billingRepo.findSubscription.mockResolvedValue(subscription);
      billingRepo.findPlanByCode.mockResolvedValue({
        ...planDefinition,
        code: 'ESCALA',
      });

      await useCase.execute({
        tenantId: 'tenant-4',
        moduleCodes: ['prospecting'], // included in ESCALA
      });

      // prospecting is includedInPlans: ['ESCALA'], so it should be filtered out
      expect(billingRepo.replaceSubscriptionModules).toHaveBeenCalledWith(
        subscription.id.toString(),
        'tenant-4',
        [], // empty because prospecting is included in ESCALA
      );
    });
  });

  describe('handles empty module list', () => {
    it('should allow replacing with empty module list (remove all addons)', async () => {
      const subscription = Subscription.create(
        TenantId.create('tenant-5'),
        'PROFISSIONAL',
      );
      billingRepo.findSubscription.mockResolvedValue(subscription);

      await useCase.execute({
        tenantId: 'tenant-5',
        moduleCodes: [],
      });

      expect(billingRepo.replaceSubscriptionModules).toHaveBeenCalledWith(
        subscription.id.toString(),
        'tenant-5',
        [],
      );
    });
  });

  describe('error handling', () => {
    it('should throw NotFoundException when subscription does not exist', async () => {
      billingRepo.findSubscription.mockResolvedValue(null);

      await expect(
        useCase.execute({
          tenantId: 'tenant-missing',
          moduleCodes: ['prospecting'],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when plan definition is not found', async () => {
      const subscription = Subscription.create(
        TenantId.create('tenant-6'),
        'PROFISSIONAL',
      );
      billingRepo.findSubscription.mockResolvedValue(subscription);
      billingRepo.findPlanByCode.mockResolvedValue(null);

      await expect(
        useCase.execute({
          tenantId: 'tenant-6',
          moduleCodes: ['prospecting'],
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
