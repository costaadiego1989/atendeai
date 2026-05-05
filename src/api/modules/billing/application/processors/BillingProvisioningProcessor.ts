import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  IBillingRepository,
  BILLING_REPOSITORY,
} from '../../domain/repositories/IBillingRepository';
import {
  IPaymentGateway,
  IPAYMENT_GATEWAY,
} from '../../../payment/domain/ports/IPaymentGateway';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import { BillingSubscriptionProvisionedIntegrationEvent } from '../integration-events/BillingIntegrationEvents';
import {
  TENANT_REPOSITORY,
  ITenantRepository,
} from '../../../tenant/domain/repositories/ITenantRepository';
import { buildSubscriptionCommercialState } from '../support/BillingCommercialConfig';
import { traceAsync } from '@shared/infrastructure/observability/DomainTrace';

export interface ProvisionTenantJob {
  tenantId: string;
  companyName?: string;
  cnpj?: string;
  plan: 'ESSENCIAL' | 'PROFISSIONAL' | 'ESCALA';
  ownerName?: string;
  ownerEmail?: string;
  ownerPhone?: string;
}

@Processor('billing-provisioning')
export class BillingProvisioningProcessor extends WorkerHost {
  private readonly logger = new Logger(BillingProvisioningProcessor.name);

  constructor(
    @Inject(BILLING_REPOSITORY)
    private readonly billingRepo: IBillingRepository,
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepository: ITenantRepository,
    @Inject(IPAYMENT_GATEWAY)
    private readonly paymentGateway: IPaymentGateway,
    @Inject(EVENT_BUS)
    private readonly eventBus: IEventBus,
  ) {
    super();
  }

  async process(job: Job<ProvisionTenantJob, any, string>): Promise<any> {
    return traceAsync(
      'billing.processor.provisioning.process',
      { 'tenant.id': job.data.tenantId },
      () => this.runProvisionJob(job),
    );
  }

  private async runProvisionJob(
    job: Job<ProvisionTenantJob, any, string>,
  ): Promise<any> {
    this.logger.log(`BullMQ provisioning para tenant ${job.data.tenantId}`);
    const { tenantId, plan } = job.data;

    try {
      const subscription = await this.billingRepo.findSubscription(tenantId);
      if (!subscription) {
        throw new Error(`Subscription not found for tenant ${tenantId}`);
      }

      if (
        subscription.asaasCustomerId &&
        (plan === 'ESSENCIAL' || subscription.asaasSubscriptionId)
      ) {
        return;
      }

      let customerId = subscription.asaasCustomerId;
      let ownerName = job.data.ownerName;
      let ownerEmail = job.data.ownerEmail;
      let cnpj = job.data.cnpj;
      let ownerPhone = job.data.ownerPhone;

      if (!customerId) {
        if (!ownerName || !ownerEmail || !cnpj || !ownerPhone) {
          const tenant = await this.tenantRepository.findById(tenantId);
          if (!tenant || !tenant.owner) {
            throw new Error(
              `Tenant or owner data not found for billing provisioning ${tenantId}`,
            );
          }

          ownerName = tenant.owner.name;
          ownerEmail = tenant.owner.email.value;
          cnpj = tenant.cnpj.value;
          ownerPhone = tenant.owner.phone.value;
        }

        const customer = await this.paymentGateway.createCustomer({
          name: ownerName,
          email: ownerEmail,
          cpfCnpj: cnpj,
          phone: ownerPhone,
          externalReference: tenantId,
        });
        customerId = customer.id;

        subscription.updateAsaasCustomer(customerId);
        await this.billingRepo.saveSubscription(subscription);
      }

      if (plan === 'ESSENCIAL') {
        return;
      }

      if (!subscription.asaasSubscriptionId && customerId) {
        const planDefinition = await this.billingRepo.findPlanByCode(plan);
        if (!planDefinition) {
          throw new Error(`Billing plan not found for provisioning ${plan}`);
        }
        const subscriptionModules =
          await this.billingRepo.listSubscriptionModules(
            subscription.id.toString(),
          );
        const commercialState = buildSubscriptionCommercialState(
          planDefinition,
          subscriptionModules,
          subscription.config,
        );
        subscription.updatePricing({
          baseMonthlyPrice: commercialState.baseMonthlyPrice,
          addonsMonthlyPrice: commercialState.addonsMonthlyPrice,
          totalMonthlyPrice: commercialState.totalMonthlyPrice,
          pricingVersion: commercialState.pricingVersion,
          pricingSnapshot: commercialState.pricingSnapshot,
        });

        const now = new Date();
        const nextDueDate = new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          now.getDate(),
        )
          .toISOString()
          .split('T')[0];

        const asaasSub = await this.paymentGateway.createSubscription({
          customer: customerId,
          billingType: 'CREDIT_CARD',
          value: commercialState.totalMonthlyPrice,
          nextDueDate,
          cycle: 'MONTHLY',
          description: `Plano ${plan} - AtendeAi`,
          externalReference: tenantId,
        });

        subscription.updateAsaasInfo(customerId, asaasSub.id);
        await this.billingRepo.saveSubscription(subscription);
        await this.eventBus.publish(
          new BillingSubscriptionProvisionedIntegrationEvent({
            tenantId,
            plan: subscription.plan,
            status: subscription.status,
            asaasCustomerId: subscription.asaasCustomerId,
            asaasSubscriptionId: subscription.asaasSubscriptionId,
          }),
        );
      }
    } catch (error) {
      if (
        job.attemptsMade >=
        ((job.opts?.attempts as number | undefined) || 3) - 1
      ) {
        const subscription = await this.billingRepo.findSubscription(tenantId);
        if (subscription) {
          subscription.markAsProvisioningFailed();
          await this.billingRepo.saveSubscription(subscription);
        }
      }
      throw error;
    }
  }
}
