import { Controller, Get, Inject } from '@nestjs/common';
import {
  BILLING_REPOSITORY,
  IBillingRepository,
} from '../../domain/repositories/IBillingRepository';

@Controller('public/billing')
export class PublicBillingController {
  constructor(
    @Inject(BILLING_REPOSITORY)
    private readonly billingRepository: IBillingRepository,
  ) {}

  @Get('plans')
  async listPlans() {
    const plans = await this.billingRepository.listPlans();
    return {
      plans: plans.map((p) => ({
        code: p.code,
        displayName: p.displayName,
        description: p.description,
        monthlyPrice: Number(p.monthlyPrice),
        messagesQuota: p.messagesQuota,
        aiTokensQuota: p.aiTokensQuota,
        contactsQuota: p.contactsQuota,
        pricingVersion: p.pricingVersion,
        features: p.features,
        sortOrder: p.sortOrder,
        active: p.active,
        isStandard: p.isStandard,
        config: p.config,
      })),
    };
  }

  @Get('niches')
  async listNiches() {
    const niches = await this.billingRepository.listNiches();
    return {
      niches: niches.map((n) => ({
        code: n.code,
        displayName: n.displayName,
        description: n.description,
        pains: n.pains,
        iconName: n.iconName,
        modules: n.modules,
        recommendations: n.recommendations ?? [],
      })),
    };
  }

  @Get('modules')
  async listModules() {
    const modules = await this.billingRepository.listModules();
    return {
      modules: modules.map((m) => ({
        code: m.code,
        displayName: m.displayName,
        description: m.description,
        category: m.category,
        billingMode: m.billingMode,
        monthlyPrice: Number(m.monthlyPrice),
        pricingVersion: m.pricingVersion,
        salesPitch: m.salesPitch,
        quotaImpact: m.quotaImpact,
        includedInPlans: m.includedInPlans,
        active: m.active,
        config: m.config,
      })),
    };
  }

  @Get('catalog')
  async getCatalogOverview() {
    const [plans, modules, niches] = await Promise.all([
      this.billingRepository.listPlans(),
      this.billingRepository.listModules(),
      this.billingRepository.listNiches(),
    ]);

    return {
      plans,
      modules,
      niches,
    };
  }
}
