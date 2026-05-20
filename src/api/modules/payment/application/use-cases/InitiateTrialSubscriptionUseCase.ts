import { Inject, Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import {
  IPaymentGateway,
  IPAYMENT_GATEWAY,
} from '../../domain/ports/IPaymentGateway';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import { TrialSubscriptionInitiatedIntegrationEvent } from '../integration-events/PaymentIntegrationEvents';
import {
  IBillingRepository,
  BILLING_REPOSITORY,
} from '@modules/billing/domain/repositories/IBillingRepository';
import { Subscription } from '@modules/billing/domain/entities/Subscription';
import { UsageRecord } from '@modules/billing/domain/entities/UsageRecord';
import { TenantId } from '@shared/domain/TenantId';
import { PlanType } from '@modules/billing/domain/value-objects/Quotas';

export interface InitiateTrialSubscriptionInput {
  tenantId: string;
  name: string;
  email: string;
  phone: string;
  companyName: string;
  plan: string;
  cnpj?: string;
}

export interface InitiateTrialSubscriptionOutput {
  subscriptionId: string;
  invoiceUrl?: string;
}

@Injectable()
export class InitiateTrialSubscriptionUseCase {
  constructor(
    @Inject(IPAYMENT_GATEWAY)
    private readonly paymentGateway: IPaymentGateway,
    @Inject(EVENT_BUS)
    private readonly eventBus: IEventBus,
    @InjectQueue('BILLING_QUEUE')
    private readonly billingQueue: Queue,
    private readonly configService: ConfigService,
    @Inject(BILLING_REPOSITORY)
    private readonly billingRepository: IBillingRepository,
  ) {}

  async execute(
    input: InitiateTrialSubscriptionInput,
  ): Promise<InitiateTrialSubscriptionOutput> {
    const customer = await this.paymentGateway.createCustomer({
      name: input.name,
      email: input.email,
      phone: input.phone,
      cpfCnpj: input.cnpj,
      externalReference: `trial-customer|${input.email}`,
    });

    const tenantIdVO = TenantId.create(input.tenantId);
    const plan = input.plan.toUpperCase() as PlanType;
    let localSubscription = await this.billingRepository.findSubscription(
      input.tenantId,
    );
    if (!localSubscription) {
      localSubscription = Subscription.create(tenantIdVO, plan);
    }
    localSubscription.updateAsaasCustomer(customer.id);
    localSubscription.activate();
    await this.billingRepository.saveSubscription(localSubscription);

    const existingUsage = await this.billingRepository.getUsage(
      input.tenantId,
      localSubscription.billingCycleStart,
    );
    if (!existingUsage) {
      const usage = UsageRecord.create(
        tenantIdVO,
        localSubscription.billingCycleStart,
        localSubscription.billingCycleEnd,
      );
      await this.billingRepository.saveUsage(usage);
    }

    await this.eventBus.publish(
      new TrialSubscriptionInitiatedIntegrationEvent({
        tenantId: input.tenantId,
        asaasCustomerId: customer.id,
        asaasSubscriptionId: '',
        plan: input.plan,
        occurredAt: new Date(),
      }),
    );

    const warningHours = this.configService.get<number>(
      'TRIAL_WARNING_HOURS',
      165,
    );
    const expirationHours = this.configService.get<number>(
      'TRIAL_EXPIRATION_HOURS',
      168,
    );

    await this.billingQueue.add(
      'check-trial-expiration',
      { subscriptionId: localSubscription.id.toString(), tenantId: input.tenantId },
      { delay: warningHours * 60 * 60 * 1000 },
    );

    await this.billingQueue.add(
      'trial-expired',
      { subscriptionId: localSubscription.id.toString(), tenantId: input.tenantId },
      { delay: expirationHours * 60 * 60 * 1000 },
    );

    return {
      subscriptionId: localSubscription.id.toString(),
    };
  }
}
