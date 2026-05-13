import { Inject, Injectable } from '@nestjs/common';
import {
  EntityNotFoundException,
} from '@shared/domain/exceptions/DomainExceptions';
import {
  BILLING_REPOSITORY,
  IBillingRepository,
} from '../../domain/repositories/IBillingRepository';
import {
  ICancelAddonPackageUseCase,
  CancelAddonPackageInput,
  CancelAddonPackageOutput,
} from './interfaces/ICancelAddonPackageUseCase';
import { ADDON_PACKAGE_MODULE_CODE } from '../../domain/constants/AddonPackages';

@Injectable()
export class CancelAddonPackageUseCase implements ICancelAddonPackageUseCase {
  constructor(
    @Inject(BILLING_REPOSITORY)
    private readonly billingRepository: IBillingRepository,
  ) {}

  async execute(
    input: CancelAddonPackageInput,
  ): Promise<CancelAddonPackageOutput> {
    const subscription = await this.billingRepository.findSubscription(
      input.tenantId,
    );

    if (!subscription) {
      throw new EntityNotFoundException('Subscription', input.tenantId);
    }

    const activeModule = await this.billingRepository.findActiveSubscriptionModule(
      input.tenantId,
      ADDON_PACKAGE_MODULE_CODE,
    );

    if (!activeModule) {
      throw new EntityNotFoundException(
        'AddonPackage',
        `Nenhum pacote adicional ativo encontrado para o tenant ${input.tenantId}`,
      );
    }

    const quotaImpact = activeModule.quotaImpact || {};

    // Revert quotas
    subscription.adjustQuotas({
      messages: -(quotaImpact.messages ?? 0),
      aiTokens: -(quotaImpact.aiTokens ?? 0),
      contacts: -(quotaImpact.contacts ?? 0),
    });

    // Revert pricing
    subscription.updatePricing({
      baseMonthlyPrice: subscription.baseMonthlyPrice,
      addonsMonthlyPrice: Math.max(
        0,
        subscription.addonsMonthlyPrice - activeModule.monthlyPrice,
      ),
    });

    await this.billingRepository.saveSubscription(subscription);

    // Mark module as canceled
    await this.billingRepository.updateSubscriptionModuleStatus(
      input.tenantId,
      ADDON_PACKAGE_MODULE_CODE,
      'CANCELED',
      new Date(),
    );

    await this.billingRepository.saveAuditLog({
      tenantId: input.tenantId,
      event: 'ADDON_PACKAGE_CANCELED',
      metadata: {
        moduleCode: ADDON_PACKAGE_MODULE_CODE,
        plan: subscription.plan,
        revertedQuotas: quotaImpact,
        revertedPrice: activeModule.monthlyPrice,
      },
    });

    return {
      tenantId: input.tenantId,
      status: 'CANCELED',
    };
  }
}
