import { Inject, Injectable } from '@nestjs/common';
import {
  EntityNotFoundException,
} from '@shared/domain/exceptions/DomainExceptions';
import {
  BILLING_REPOSITORY,
  IBillingRepository,
} from '../../domain/repositories/IBillingRepository';
import {
  IGetAddonPackageInfoUseCase,
  GetAddonPackageInfoInput,
  GetAddonPackageInfoOutput,
} from './interfaces/IGetAddonPackageInfoUseCase';
import {
  getAddonPackageForPlan,
  ADDON_PACKAGE_MODULE_CODE,
} from '../../domain/constants/AddonPackages';

@Injectable()
export class GetAddonPackageInfoUseCase implements IGetAddonPackageInfoUseCase {
  constructor(
    @Inject(BILLING_REPOSITORY)
    private readonly billingRepository: IBillingRepository,
  ) {}

  async execute(
    input: GetAddonPackageInfoInput,
  ): Promise<GetAddonPackageInfoOutput> {
    const subscription = await this.billingRepository.findSubscription(
      input.tenantId,
    );

    if (!subscription) {
      throw new EntityNotFoundException('Subscription', input.tenantId);
    }

    const packageDef = getAddonPackageForPlan(subscription.plan);

    if (!packageDef) {
      return {
        tenantId: input.tenantId,
        available: false,
        active: false,
        package: null,
      };
    }

    const activeModule = await this.billingRepository.findActiveSubscriptionModule(
      input.tenantId,
      ADDON_PACKAGE_MODULE_CODE,
    );

    const planCatalog = await this.billingRepository.findPlanByCode(
      subscription.plan,
    );

    const packagePrice = planCatalog
      ? Math.round(Number(planCatalog.monthlyPrice) * packageDef.priceMultiplier)
      : 0;

    return {
      tenantId: input.tenantId,
      available: true,
      active: !!activeModule,
      package: {
        messages: packageDef.messages,
        aiTokens: packageDef.aiTokens,
        contacts: packageDef.contacts,
        price: packagePrice,
      },
    };
  }
}
