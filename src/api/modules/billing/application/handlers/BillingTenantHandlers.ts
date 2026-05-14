import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import {
  IBillingRepository,
  BILLING_REPOSITORY,
} from '../../domain/repositories/IBillingRepository';
import { Subscription } from '../../domain/entities/Subscription';
import { UsageRecord } from '../../domain/entities/UsageRecord';
import { TenantId } from '../../../../shared/domain/TenantId';
import { PlanType } from '../../domain/value-objects/Quotas';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { BillingSubscriptionActivatedIntegrationEvent } from '../integration-events/BillingIntegrationEvents';
import { buildSubscriptionCommercialState } from '../support/BillingCommercialConfig';

interface TenantCreatedPayload {
  aggregateId: string;
  companyName: string;
  cnpj: string;
  plan: PlanType;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  isTrial?: boolean;
}

interface TenantPlanChangedPayload {
  aggregateId: string;
  oldPlan: PlanType;
  newPlan: PlanType;
}

interface TrialInitiatedPayload {
  tenantId: string;
  asaasCustomerId: string;
  asaasSubscriptionId: string;
  plan: string;
}

@Injectable()
export class BillingTenantHandlers implements OnModuleInit {
  constructor(
    @Inject(EVENT_BUS)
    private readonly eventBus: IEventBus,
    @Inject(BILLING_REPOSITORY)
    private readonly billingRepository: IBillingRepository,
    @InjectQueue('billing-provisioning')
    private readonly provisioningQueue: Queue,
  ) {}

  onModuleInit() {
    this.eventBus.subscribe(
      'tenant.created',
      async (event) => {
        const payload = event.payload as unknown as TenantCreatedPayload;
        const tenantId = TenantId.create(payload.aggregateId);

        const existingSubscription =
          await this.billingRepository.findSubscription(tenantId.toValue());
        const planDefinition = await this.billingRepository.findPlanByCode(
          payload.plan,
        );
        const existingModules = existingSubscription
          ? await this.billingRepository.listSubscriptionModules(
              existingSubscription.id.toString(),
            )
          : [];

        if (
          existingSubscription &&
          existingSubscription.asaasCustomerId &&
          (payload.plan === 'ESSENCIAL' ||
            existingSubscription.asaasSubscriptionId)
        ) {
          return;
        }

        const subscription =
          existingSubscription ||
          Subscription.create(
            tenantId,
            payload.plan,
            planDefinition
              ? buildSubscriptionCommercialState(
                  planDefinition,
                  existingModules,
                )
              : undefined,
          );

        if (existingSubscription && planDefinition) {
          subscription.changePlan(
            payload.plan,
            buildSubscriptionCommercialState(
              planDefinition,
              existingModules,
              subscription.config,
            ),
          );
        }

        await this.billingRepository.saveSubscription(subscription);

        await this.billingRepository.saveAuditLog({
          tenantId: tenantId.toValue(),
          event: 'SUBSCRIPTION_CREATED',
          newPlan: payload.plan,
          metadata: { source: 'tenant.created' },
        });

        if (
          !payload.isTrial &&
          (!subscription.asaasCustomerId ||
            (payload.plan !== 'ESSENCIAL' && !subscription.asaasSubscriptionId))
        ) {
          await this.provisioningQueue.add(
            'provision-tenant',
            {
              tenantId: tenantId.toValue(),
              companyName: payload.companyName,
              cnpj: payload.cnpj,
              plan: payload.plan,
              ownerName: payload.ownerName,
              ownerEmail: payload.ownerEmail,
              ownerPhone: payload.ownerPhone,
            },
            {
              attempts: 3,
              backoff: {
                type: 'exponential',
                delay: 2000,
              },
            },
          );
        }

        const usage = UsageRecord.create(
          tenantId,
          subscription.billingCycleStart,
          subscription.billingCycleEnd,
        );
        await this.billingRepository.saveUsage(usage);

        if (subscription.status === 'ACTIVE') {
          await this.eventBus.publish(
            new BillingSubscriptionActivatedIntegrationEvent({
              tenantId: tenantId.toValue(),
              plan: subscription.plan,
              billingCycleStart: subscription.billingCycleStart.toISOString(),
              billingCycleEnd: subscription.billingCycleEnd.toISOString(),
            }),
          );
        }
      },
      { consumerName: 'billing-tenant-created' },
    );

    this.eventBus.subscribe(
      'tenant.plan-changed',
      async (event) => {
        const payload = event.payload as unknown as TenantPlanChangedPayload;
        const tenantId = payload.aggregateId;
        const subscription =
          await this.billingRepository.findSubscription(tenantId);

        if (!subscription) {
          return;
        }

        const planDefinition = await this.billingRepository.findPlanByCode(
          payload.newPlan,
        );
        const existingModules =
          await this.billingRepository.listSubscriptionModules(
            subscription.id.toString(),
          );

        const oldPlan = subscription.plan;
        subscription.changePlan(
          payload.newPlan,
          planDefinition
            ? buildSubscriptionCommercialState(
                planDefinition,
                existingModules,
                subscription.config,
              )
            : undefined,
        );
        await this.billingRepository.saveSubscription(subscription);

        await this.billingRepository.saveAuditLog({
          tenantId,
          event: 'PLAN_CHANGED',
          oldPlan,
          newPlan: payload.newPlan,
          metadata: { source: 'tenant.plan-changed' },
        });

        if (
          !subscription.asaasCustomerId ||
          (payload.newPlan !== 'ESSENCIAL' && !subscription.asaasSubscriptionId)
        ) {
          await this.provisioningQueue.add(
            'provision-tenant',
            {
              tenantId,
              plan: payload.newPlan,
            },
            {
              attempts: 3,
              backoff: {
                type: 'exponential',
                delay: 2000,
              },
            },
          );
        }
      },
      { consumerName: 'billing-tenant-plan-changed' },
    );

    this.eventBus.subscribe(
      'payment.trial-subscription-initiated.v1',
      async (event) => {
        const payload = event.payload as unknown as TrialInitiatedPayload;
        const tenantId = payload.tenantId;

        let subscription =
          await this.billingRepository.findSubscription(tenantId);
        const plan = payload.plan as PlanType;
        const planDefinition =
          await this.billingRepository.findPlanByCode(plan);

        if (!subscription) {
          subscription = Subscription.create(
            TenantId.create(tenantId),
            plan,
            planDefinition
              ? buildSubscriptionCommercialState(planDefinition)
              : undefined,
          );
        } else if (planDefinition) {
          const existingModules =
            await this.billingRepository.listSubscriptionModules(
              subscription.id.toString(),
            );
          subscription.changePlan(
            plan,
            buildSubscriptionCommercialState(
              planDefinition,
              existingModules,
              subscription.config,
            ),
          );
        }

        subscription.updateAsaasInfo(
          payload.asaasCustomerId,
          payload.asaasSubscriptionId,
        );
        subscription.activate();

        await this.billingRepository.saveSubscription(subscription);

        let usage = await this.billingRepository.getUsage(
          tenantId,
          subscription.billingCycleStart,
        );
        if (!usage) {
          usage = UsageRecord.create(
            TenantId.create(tenantId),
            subscription.billingCycleStart,
            subscription.billingCycleEnd,
          );
          await this.billingRepository.saveUsage(usage);
        }

        await this.billingRepository.saveAuditLog({
          tenantId,
          event: 'TRIAL_ACTIVATED',
          newPlan: payload.plan,
          metadata: {
            source: 'payment.trial-subscription-initiated',
            asaasSubscriptionId: payload.asaasSubscriptionId,
          },
        });
      },
      { consumerName: 'billing-trial-initiated' },
    );
  }
}
