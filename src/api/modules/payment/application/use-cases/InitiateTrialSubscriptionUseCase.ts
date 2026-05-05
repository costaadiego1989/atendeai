import { Inject, Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import {
    IPaymentGateway,
    IPAYMENT_GATEWAY,
} from '../../domain/ports/IPaymentGateway';
import { PLAN_PRICES } from '../../domain/constants/PlanPrices';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import { TrialSubscriptionInitiatedIntegrationEvent } from '../integration-events/PaymentIntegrationEvents';

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
    ) { }

    async execute(
        input: InitiateTrialSubscriptionInput,
    ): Promise<InitiateTrialSubscriptionOutput> {
        const planPrice = PLAN_PRICES[input.plan.toUpperCase()] || PLAN_PRICES.ESSENCIAL;

        const customer = await this.paymentGateway.createCustomer({
            name: input.name,
            email: input.email,
            phone: input.phone,
            cpfCnpj: input.cnpj,
            externalReference: `trial-customer|${input.email}`,
        });

        const externalReference = `trial|${input.tenantId}`;
        const nextDueDate = new Date();

        nextDueDate.setDate(nextDueDate.getDate() + 7);

        const subscription = await this.paymentGateway.createSubscription({
            customer: customer.id,
            billingType: 'CREDIT_CARD',
            value: planPrice,
            nextDueDate: nextDueDate.toISOString().split('T')[0],
            cycle: 'MONTHLY',
            description: `Assinatura Plano ${input.plan} - AtendeAí (7 dias grátis)`,
            externalReference,
            trialDays: 7,
        });

        await this.eventBus.publish(
            new TrialSubscriptionInitiatedIntegrationEvent({
                tenantId: input.tenantId,
                asaasCustomerId: customer.id,
                asaasSubscriptionId: subscription.id,
                plan: input.plan,
                occurredAt: new Date(),
            })
        );

        const warningHours = this.configService.get<number>('TRIAL_WARNING_HOURS', 165);
        const expirationHours = this.configService.get<number>('TRIAL_EXPIRATION_HOURS', 168);

        await this.billingQueue.add(
            'check-trial-expiration',
            { subscriptionId: subscription.id, tenantId: input.tenantId },
            { delay: warningHours * 60 * 60 * 1000 }
        );

        await this.billingQueue.add(
            'trial-expired',
            { subscriptionId: subscription.id, tenantId: input.tenantId },
            { delay: expirationHours * 60 * 60 * 1000 }
        );

        return {
            subscriptionId: subscription.id,
            invoiceUrl: subscription.invoiceUrl,
        };
    }
}
