import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { TenantModuleAccessService } from '@shared/infrastructure/billing/TenantModuleAccessService';
import {
  BILLING_REPOSITORY,
  BusinessNicheRecord,
  IBillingRepository,
} from '../../domain/repositories/IBillingRepository';
import {
  GetSubscriptionCatalogInput,
  GetSubscriptionCatalogOutput,
  IGetSubscriptionCatalogUseCase,
} from './interfaces/IGetSubscriptionCatalogUseCase';
import { resolveBillingNicheCode } from '../support/BillingNicheResolver';

@Injectable()
export class GetSubscriptionCatalogUseCase
  implements IGetSubscriptionCatalogUseCase
{
  constructor(
    @Inject(BILLING_REPOSITORY)
    private readonly billingRepository: IBillingRepository,
    private readonly prisma: PrismaService,
    private readonly tenantModuleAccessService: TenantModuleAccessService,
  ) {}

  async execute(
    input: GetSubscriptionCatalogInput,
  ): Promise<GetSubscriptionCatalogOutput> {
    const [subscription, tenant, modules, niches, billingAccess] =
      await Promise.all([
        this.billingRepository.findSubscription(input.tenantId),
        this.prisma.tenant.findUnique({
          where: { id: input.tenantId },
          select: { businessType: true },
        }),
        this.billingRepository.listModules(),
        this.billingRepository.listNiches(),
        this.tenantModuleAccessService.getSummary(input.tenantId),
      ]);

    if (!subscription) {
      const niche = this.resolveNiche(tenant?.businessType, niches);
      const recommendations = new Map(
        (niche?.recommendations ?? []).map((recommendation) => [
          recommendation.moduleCode,
          recommendation,
        ]),
      );

      const availableAddons = modules
        .filter((module) => module.billingMode === 'ADDON')
        .map((module) => {
          const recommendation = recommendations.get(module.code);
          return {
            code: module.code,
            displayName: module.displayName,
            description: module.description ?? null,
            category: module.category ?? null,
            monthlyPrice: Number(module.monthlyPrice || 0),
            pricingVersion: module.pricingVersion ?? null,
            salesPitch: module.salesPitch ?? null,
            includedInPlans: module.includedInPlans ?? [],
            subscribed: false,
            includedInPlan: false,
            enabled: false,
            recommended: Boolean(recommendation?.isRecommended),
            primaryRecommendation: Boolean(recommendation?.isPrimary),
            marketingHeadline: recommendation?.marketingHeadline ?? null,
            recommendationSalesPitch: recommendation?.salesPitch ?? null,
            selectable: true,
          };
        })
        .sort((left, right) => {
          if (left.primaryRecommendation !== right.primaryRecommendation) {
            return left.primaryRecommendation ? -1 : 1;
          }
          if (left.recommended !== right.recommended) {
            return left.recommended ? -1 : 1;
          }
          return left.displayName.localeCompare(right.displayName, 'pt-BR');
        });

      return {
        tenantId: input.tenantId,
        businessType: tenant?.businessType ?? null,
        niche: niche
          ? {
              code: niche.code,
              displayName: niche.displayName,
              description: niche.description ?? null,
              pains: niche.pains ?? [],
            }
          : null,
        subscription: billingAccess,
        availableAddons,
      };
    }

    const niche = this.resolveNiche(tenant?.businessType, niches);
    const recommendations = new Map(
      (niche?.recommendations ?? []).map((recommendation) => [
        recommendation.moduleCode,
        recommendation,
      ]),
    );

    const availableAddons = modules
      .filter((module) => module.billingMode === 'ADDON')
      .map((module) => {
        const recommendation = recommendations.get(module.code);
        const subscribed = billingAccess.addonModules.includes(module.code);
        const includedInPlan = billingAccess.includedModules.includes(module.code);
        const enabled = billingAccess.enabledModules.includes(module.code);

        return {
          code: module.code,
          displayName: module.displayName,
          description: module.description ?? null,
          category: module.category ?? null,
          monthlyPrice: Number(module.monthlyPrice || 0),
          pricingVersion: module.pricingVersion ?? null,
          salesPitch: module.salesPitch ?? null,
          includedInPlans: module.includedInPlans ?? [],
          subscribed,
          includedInPlan,
          enabled,
          recommended: Boolean(recommendation?.isRecommended),
          primaryRecommendation: Boolean(recommendation?.isPrimary),
          marketingHeadline: recommendation?.marketingHeadline ?? null,
          recommendationSalesPitch: recommendation?.salesPitch ?? null,
          selectable: !includedInPlan,
        };
      })
      .sort((left, right) => {
        if (left.primaryRecommendation !== right.primaryRecommendation) {
          return left.primaryRecommendation ? -1 : 1;
        }

        if (left.recommended !== right.recommended) {
          return left.recommended ? -1 : 1;
        }

        return left.displayName.localeCompare(right.displayName, 'pt-BR');
      });

    return {
      tenantId: input.tenantId,
      businessType: tenant?.businessType ?? null,
      niche: niche
        ? {
            code: niche.code,
            displayName: niche.displayName,
            description: niche.description ?? null,
            pains: niche.pains ?? [],
          }
        : null,
      subscription: billingAccess,
      availableAddons,
    };
  }

  private resolveNiche(
    businessType: string | null | undefined,
    niches: BusinessNicheRecord[],
  ): BusinessNicheRecord | null {
    const nicheCode = resolveBillingNicheCode(businessType);
    if (!nicheCode) {
      return null;
    }

    return niches.find((niche) => niche.code === nicheCode) ?? null;
  }
}
