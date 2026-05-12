import {
  buildSubscriptionCommercialState,
  SubscriptionCommercialState,
} from '../application/support/BillingCommercialConfig';
import { resolveBillingNicheCode } from '../application/support/BillingNicheResolver';
import { applyEnterprisePlanBenefits } from '../application/support/BillingPlanBenefits';
import { BillingPlanCatalogRecord } from '../domain/repositories/IBillingRepository';

describe('BillingCommercialConfig', () => {
  describe('buildSubscriptionCommercialState', () => {
    const basePlanDefinition: BillingPlanCatalogRecord = {
      code: 'PROFISSIONAL',
      displayName: 'Profissional',
      description: 'Plano profissional',
      monthlyPrice: 297,
      messagesQuota: 75000,
      aiTokensQuota: 7500000,
      contactsQuota: 2500,
      pricingVersion: 'v2',
      sortOrder: 2,
      active: true,
      features: ['CRM', 'AI'],
      isStandard: true,
      config: { modules: { crm: true, inbox: true } },
    };

    it('should build commercial state with correct base pricing', () => {
      const result = buildSubscriptionCommercialState(basePlanDefinition);

      expect(result.baseMonthlyPrice).toBe(297);
      expect(result.addonsMonthlyPrice).toBe(0);
      expect(result.totalMonthlyPrice).toBe(297);
      expect(result.pricingVersion).toBe('v2');
    });

    it('should include quotas from plan definition', () => {
      const result = buildSubscriptionCommercialState(basePlanDefinition);

      expect(result.quotas.messages).toBe(75000);
      expect(result.quotas.aiTokens).toBe(7500000);
      expect(result.quotas.contacts).toBe(2500);
    });

    it('should calculate addons monthly price from active modules', () => {
      const modules = [
        {
          subscriptionId: 'sub-1',
          tenantId: 'tenant-1',
          moduleCode: 'prospecting',
          status: 'ACTIVE',
          monthlyPrice: 49,
          pricingVersion: null,
          pricingSnapshot: {},
          quotaImpact: {},
          metadata: {},
          startedAt: new Date(),
          endedAt: null,
        },
        {
          subscriptionId: 'sub-1',
          tenantId: 'tenant-1',
          moduleCode: 'recovery',
          status: 'ACTIVE',
          monthlyPrice: 39,
          pricingVersion: null,
          pricingSnapshot: {},
          quotaImpact: {},
          metadata: {},
          startedAt: new Date(),
          endedAt: null,
        },
      ];

      const result = buildSubscriptionCommercialState(basePlanDefinition, modules);

      expect(result.addonsMonthlyPrice).toBe(88);
      expect(result.totalMonthlyPrice).toBe(297 + 88);
    });

    it('should include plan modules in config', () => {
      const result = buildSubscriptionCommercialState(basePlanDefinition);

      expect(result.config.modules.crm).toBe(true);
      expect(result.config.modules.inbox).toBe(true);
    });

    it('should merge addon modules into config', () => {
      const modules = [
        {
          subscriptionId: 'sub-1',
          tenantId: 'tenant-1',
          moduleCode: 'prospecting',
          status: 'ACTIVE',
          monthlyPrice: 49,
          pricingVersion: null,
          pricingSnapshot: {},
          quotaImpact: {},
          metadata: {},
          startedAt: new Date(),
          endedAt: null,
        },
      ];

      const result = buildSubscriptionCommercialState(basePlanDefinition, modules);

      expect(result.config.modules.prospecting).toBe(true);
      expect(result.config.modules.crm).toBe(true);
    });

    it('should preserve currentConfig fields', () => {
      const currentConfig = { customField: 'value', modules: {} };
      const result = buildSubscriptionCommercialState(
        basePlanDefinition,
        [],
        currentConfig,
      );

      expect(result.config.customField).toBe('value');
    });

    it('should not count inactive modules in pricing', () => {
      const modules = [
        {
          subscriptionId: 'sub-1',
          tenantId: 'tenant-1',
          moduleCode: 'prospecting',
          status: 'CANCELLED',
          monthlyPrice: 49,
          pricingVersion: null,
          pricingSnapshot: {},
          quotaImpact: {},
          metadata: {},
          startedAt: new Date(),
          endedAt: new Date(),
        },
      ];

      const result = buildSubscriptionCommercialState(basePlanDefinition, modules);

      expect(result.addonsMonthlyPrice).toBe(0);
      expect(result.totalMonthlyPrice).toBe(297);
    });
  });

  describe('resolveBillingNicheCode (niche resolver)', () => {
    it('should resolve RETAIL to RETAIL', () => {
      expect(resolveBillingNicheCode('RETAIL')).toBe('RETAIL');
    });

    it('should resolve BAKERY to FOOD', () => {
      expect(resolveBillingNicheCode('BAKERY')).toBe('FOOD');
    });

    it('should resolve CLINIC to HEALTH', () => {
      expect(resolveBillingNicheCode('CLINIC')).toBe('HEALTH');
    });

    it('should resolve LEGAL to HOME_SERV', () => {
      expect(resolveBillingNicheCode('LEGAL')).toBe('HOME_SERV');
    });

    it('should return null for null/undefined input', () => {
      expect(resolveBillingNicheCode(null)).toBeNull();
      expect(resolveBillingNicheCode(undefined)).toBeNull();
    });

    it('should return the businessType itself when not in mapping', () => {
      expect(resolveBillingNicheCode('CUSTOM_TYPE')).toBe('CUSTOM_TYPE');
    });
  });

  describe('applyEnterprisePlanBenefits (plan benefits mapping)', () => {
    it('should apply ESSENCIAL benefits', () => {
      const plan: BillingPlanCatalogRecord = {
        code: 'ESSENCIAL',
        displayName: 'Essencial',
        monthlyPrice: 97,
        messagesQuota: 15000,
        aiTokensQuota: 1500000,
        contactsQuota: 500,
        sortOrder: 1,
        active: true,
        features: [],
        isStandard: true,
        config: {},
      };

      const result = applyEnterprisePlanBenefits(plan);

      expect(result.features.length).toBeGreaterThan(0);
      expect(result.features).toContain('1 numero de WhatsApp conectado');
    });

    it('should merge configured features with standard benefits', () => {
      const plan: BillingPlanCatalogRecord = {
        code: 'PROFISSIONAL',
        displayName: 'Profissional',
        monthlyPrice: 297,
        messagesQuota: 75000,
        aiTokensQuota: 7500000,
        contactsQuota: 2500,
        sortOrder: 2,
        active: true,
        features: ['Custom Feature'],
        isStandard: true,
        config: {},
      };

      const result = applyEnterprisePlanBenefits(plan);

      expect(result.features).toContain('Custom Feature');
      expect(result.features).toContain('IA com contexto comercial por nicho');
    });

    it('should deduplicate features', () => {
      const plan: BillingPlanCatalogRecord = {
        code: 'ESCALA',
        displayName: 'Escala',
        monthlyPrice: 497,
        messagesQuota: 300000,
        aiTokensQuota: 30000000,
        contactsQuota: 10000,
        sortOrder: 3,
        active: true,
        features: ['Ate 10 filiais ativas incluidas'],
        isStandard: true,
        config: {},
      };

      const result = applyEnterprisePlanBenefits(plan);

      const count = result.features.filter(
        (f: string) => f === 'Ate 10 filiais ativas incluidas',
      ).length;
      expect(count).toBe(1);
    });
  });
});
