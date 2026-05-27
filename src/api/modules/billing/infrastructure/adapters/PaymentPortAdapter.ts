import { Inject, Injectable } from '@nestjs/common';
import {
  IPaymentFacade,
  PAYMENT_FACADE,
} from '../../../payment/application/facades/IPaymentFacade';
import {
  IPaymentPort,
  CreateCustomerInput,
  CreateSubscriptionInput,
  UpdateSubscriptionInput,
  CreatePaymentLinkInput,
} from '../../application/ports/IPaymentPort';

/**
 * Adapter implementing IPaymentPort.
 * Encapsulates all payment module access behind the billing-owned port interface.
 */
@Injectable()
export class PaymentPortAdapter implements IPaymentPort {
  constructor(
    @Inject(PAYMENT_FACADE)
    private readonly paymentFacade: IPaymentFacade,
  ) {}

  async createCustomer(
    input: CreateCustomerInput,
  ): Promise<{ customerId: string }> {
    const result = await this.paymentFacade.createCustomer({
      name: input.name,
      email: input.email,
      cpfCnpj: input.cpfCnpj,
      phone: input.phone,
      externalReference: input.externalReference,
    });

    return { customerId: result.id };
  }

  async createSubscription(
    input: CreateSubscriptionInput,
  ): Promise<{ subscriptionId: string }> {
    const result = await this.paymentFacade.createSubscription({
      customer: input.customer,
      billingType: input.billingType,
      value: input.value,
      nextDueDate: input.nextDueDate,
      cycle: input.cycle,
      description: input.description,
      externalReference: input.externalReference,
    });

    return { subscriptionId: result.id };
  }

  async updateSubscription(
    subscriptionId: string,
    input: UpdateSubscriptionInput,
  ): Promise<void> {
    await this.paymentFacade.updateSubscription(subscriptionId, {
      billingType: input.billingType,
      value: input.value,
      nextDueDate: input.nextDueDate,
      cycle: input.cycle,
      description: input.description,
      externalReference: input.externalReference,
      updatePendingPayments: input.updatePendingPayments,
    });
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    await this.paymentFacade.cancelSubscription(subscriptionId);
  }

  async createPaymentLink(
    input: CreatePaymentLinkInput,
  ): Promise<{ url: string; id: string }> {
    const result = await this.paymentFacade.createPaymentLink({
      name: input.name,
      description: input.description,
      value: input.value,
      externalReference: input.externalReference,
      billingType: input.billingType,
      chargeType: input.chargeType,
      dueDateLimitDays: input.dueDateLimitDays,
    });

    return { url: result.url, id: result.id };
  }
}
