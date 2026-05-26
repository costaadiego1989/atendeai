import { Inject, Injectable } from '@nestjs/common';
import {
  EntityNotFoundException,
  DomainException,
} from '@shared/domain/exceptions/DomainExceptions';
import {
  BILLING_REPOSITORY,
  IBillingRepository,
} from '../../domain/repositories/IBillingRepository';
import { IPaymentPort, BILLING_PAYMENT_PORT } from '../ports/IPaymentPort';
import {
  IPurchaseAddonPackageUseCase,
  PurchaseAddonPackageInput,
  PurchaseAddonPackageOutput,
} from './interfaces/IPurchaseAddonPackageUseCase';
import {
  getAddonPackageForPlan,
  ADDON_PACKAGE_MODULE_CODE,
} from '../../domain/constants/AddonPackages';
import { EnsureCustomerService } from '../services/EnsureCustomerService';

@Injectable()
export class PurchaseAddonPackageUseCase implements IPurchaseAddonPackageUseCase {
  constructor(
    @Inject(BILLING_REPOSITORY)
    private readonly billingRepository: IBillingRepository,
    @Inject(BILLING_PAYMENT_PORT)
    private readonly paymentPort: IPaymentPort,
    private readonly ensureCustomerService: EnsureCustomerService,
  ) {}

  async execute(
    input: PurchaseAddonPackageInput,
  ): Promise<PurchaseAddonPackageOutput> {
    const subscription = await this.billingRepository.findSubscription(
      input.tenantId,
    );

    if (!subscription) {
      throw new EntityNotFoundException('Subscription', input.tenantId);
    }

    if (subscription.plan === 'TRIAL') {
      throw new DomainException(
        'Pacotes adicionais não estão disponíveis para o plano Trial. Faça upgrade para um plano pago.',
      );
    }

    const existingModule =
      await this.billingRepository.findActiveSubscriptionModule(
        input.tenantId,
        ADDON_PACKAGE_MODULE_CODE,
      );

    if (existingModule) {
      throw new DomainException(
        'Já possui um pacote adicional ativo neste ciclo. Apenas 1 pacote por ciclo é permitido.',
      );
    }

    const packageDef = getAddonPackageForPlan(subscription.plan);
    if (!packageDef) {
      throw new DomainException(
        'Pacote adicional não disponível para o plano atual.',
      );
    }

    const planCatalog = await this.billingRepository.findPlanByCode(
      subscription.plan,
    );
    if (!planCatalog) {
      throw new EntityNotFoundException(
        'BillingPlanCatalog',
        subscription.plan,
      );
    }

    const packagePrice = Math.round(
      Number(planCatalog.monthlyPrice) * packageDef.priceMultiplier,
    );

    // Adjust quotas on the subscription
    subscription.adjustQuotas({
      messages: packageDef.messages,
      aiTokens: packageDef.aiTokens,
      contacts: packageDef.contacts,
    });

    subscription.updatePricing({
      baseMonthlyPrice: subscription.baseMonthlyPrice,
      addonsMonthlyPrice: subscription.addonsMonthlyPrice + packagePrice,
    });

    await this.billingRepository.saveSubscription(subscription);

    // Create the subscription module record
    await this.billingRepository.saveSubscriptionModule(
      input.tenantId,
      subscription.id.toString(),
      {
        moduleCode: ADDON_PACKAGE_MODULE_CODE,
        status: 'ACTIVE',
        monthlyPrice: packagePrice,
        pricingVersion: planCatalog.pricingVersion,
        pricingSnapshot: {
          planCode: subscription.plan,
          planMonthlyPrice: Number(planCatalog.monthlyPrice),
          multiplier: packageDef.priceMultiplier,
        },
        quotaImpact: {
          messages: packageDef.messages,
          aiTokens: packageDef.aiTokens,
          contacts: packageDef.contacts,
        },
        metadata: {
          oneShot: true,
          cycleEnd: subscription.billingCycleEnd.toISOString(),
        },
        startedAt: new Date(),
        endedAt: null,
      },
    );

    // Create payment link via port
    await this.ensureCustomerService.ensure(input.tenantId, subscription);
    const paymentLink = await this.paymentPort.createPaymentLink({
      name: `Pacote Adicional de Quota - ${subscription.plan}`,
      description: `Pacote adicional (+${packageDef.messages.toLocaleString()} msgs, +${packageDef.contacts.toLocaleString()} contatos) para o ciclo atual`,
      value: packagePrice,
      externalReference: `billing-addon|${input.tenantId}|${ADDON_PACKAGE_MODULE_CODE}`,
      billingType: 'UNDEFINED',
      chargeType: 'DETACHED',
      dueDateLimitDays: 1,
    });

    await this.billingRepository.saveAuditLog({
      tenantId: input.tenantId,
      event: 'ADDON_PACKAGE_PURCHASED',
      metadata: {
        moduleCode: ADDON_PACKAGE_MODULE_CODE,
        plan: subscription.plan,
        price: packagePrice,
        quotaImpact: {
          messages: packageDef.messages,
          aiTokens: packageDef.aiTokens,
          contacts: packageDef.contacts,
        },
      },
    });

    return {
      tenantId: input.tenantId,
      package: {
        messages: packageDef.messages,
        aiTokens: packageDef.aiTokens,
        contacts: packageDef.contacts,
        price: packagePrice,
      },
      mode: 'CHECKOUT_REQUIRED',
      checkoutUrl: paymentLink.url,
    };
  }
}
