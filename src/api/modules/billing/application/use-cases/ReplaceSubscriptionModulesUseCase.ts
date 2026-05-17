import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TenantModuleAccessService } from '@shared/infrastructure/billing/TenantModuleAccessService';
import {
  BILLING_REPOSITORY,
  IBillingRepository,
} from '../../domain/repositories/IBillingRepository';
import { buildSubscriptionCommercialState } from '../support/BillingCommercialConfig';
import {
  IReplaceSubscriptionModulesUseCase,
  ReplaceSubscriptionModulesInput,
  ReplaceSubscriptionModulesOutput,
} from './interfaces/IReplaceSubscriptionModulesUseCase';

@Injectable()
export class ReplaceSubscriptionModulesUseCase implements IReplaceSubscriptionModulesUseCase {
  constructor(
    @Inject(BILLING_REPOSITORY)
    private readonly billingRepository: IBillingRepository,
    private readonly tenantModuleAccessService: TenantModuleAccessService,
  ) {}

  async execute(
    input: ReplaceSubscriptionModulesInput,
  ): Promise<ReplaceSubscriptionModulesOutput> {
    const subscription = await this.billingRepository.findSubscription(
      input.tenantId,
    );

    if (!subscription) {
      throw new NotFoundException(
        `Subscription for tenant ${input.tenantId} not found`,
      );
    }

    const [planDefinition, modules, currentSubscriptionModules] =
      await Promise.all([
        this.billingRepository.findPlanByCode(subscription.plan),
        this.billingRepository.listModules(),
        this.billingRepository.listSubscriptionModules(
          subscription.id.toString(),
        ),
      ]);

    if (!planDefinition) {
      throw new NotFoundException(
        `Plan definition ${subscription.plan} not found`,
      );
    }

    const requestedModuleCodes = Array.from(
      new Set(
        (input.moduleCodes ?? [])
          .map((moduleCode) => moduleCode?.trim())
          .filter((moduleCode): moduleCode is string => Boolean(moduleCode)),
      ),
    );

    const addonCatalog = new Map(
      modules
        .filter((module) => module.active && module.billingMode === 'ADDON')
        .map((module) => [module.code, module] as const),
    );

    const invalidModuleCodes = requestedModuleCodes.filter(
      (moduleCode) => !addonCatalog.has(moduleCode),
    );

    if (invalidModuleCodes.length) {
      throw new BadRequestException(
        `Invalid add-ons: ${invalidModuleCodes.join(', ')}`,
      );
    }

    const activeModuleCodes = requestedModuleCodes.filter((moduleCode) => {
      const module = addonCatalog.get(moduleCode);
      return !module?.includedInPlans?.includes(subscription.plan);
    });

    const currentModuleMap = new Map(
      currentSubscriptionModules.map((module) => [module.moduleCode, module]),
    );

    const replacementModules = activeModuleCodes.map((moduleCode) => {
      const module = addonCatalog.get(moduleCode)!;
      const currentModule = currentModuleMap.get(moduleCode);

      return {
        moduleCode,
        status: 'ACTIVE',
        monthlyPrice: Number(module.monthlyPrice || 0),
        pricingVersion: module.pricingVersion ?? undefined,
        pricingSnapshot: {
          code: module.code,
          displayName: module.displayName,
          description: module.description ?? null,
          monthlyPrice: Number(module.monthlyPrice || 0),
          pricingVersion: module.pricingVersion ?? undefined,
        },
        quotaImpact: module.quotaImpact ?? {},
        metadata: {
          category: module.category ?? null,
          billingMode: module.billingMode,
        },
        startedAt: currentModule?.startedAt ?? new Date(),
        endedAt: null,
      };
    });

    const commercialState = buildSubscriptionCommercialState(
      planDefinition,
      replacementModules.map((module) => ({
        subscriptionId: subscription.id.toString(),
        tenantId: input.tenantId,
        ...module,
      })),
      subscription.config,
    );

    subscription.changePlan(subscription.plan, commercialState);

    await this.billingRepository.saveSubscription(subscription);
    await this.billingRepository.replaceSubscriptionModules(
      subscription.id.toString(),
      input.tenantId,
      replacementModules,
    );
    await this.billingRepository.saveAuditLog({
      tenantId: input.tenantId,
      event: 'SUBSCRIPTION_MODULES_UPDATED',
      oldPlan: subscription.plan,
      newPlan: subscription.plan,
      metadata: {
        moduleCodes: activeModuleCodes,
        includedModules: requestedModuleCodes.filter((moduleCode) =>
          addonCatalog
            .get(moduleCode)
            ?.includedInPlans?.includes(subscription.plan),
        ),
      },
    });

    return {
      tenantId: input.tenantId,
      subscription: await this.tenantModuleAccessService.getSummary(
        input.tenantId,
      ),
    };
  }
}
