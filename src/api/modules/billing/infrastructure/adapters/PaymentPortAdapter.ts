import { Inject, Injectable } from '@nestjs/common';
import {
  IPaymentGateway,
  IPAYMENT_GATEWAY,
} from '../../../payment/domain/ports/IPaymentGateway';
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
    @Inject(IPAYMENT_GATEWAY)
    private readonly paymentGateway: IPaymentGateway,
  ) {}

  async createCustomer(
    input: CreateCustomerInput,
  ): Promise<{ customerId: string }> {
    const result = await this.paymentGateway.createCustomer({
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
    const result = await this.paymentGateway.createSubscription({
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
    await this.paymentGateway.updateSubscription(subscriptionId, {
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
    await this.paymentGateway.cancelSubscription(subscriptionId);
  }

  async createPaymentLink(
    input: CreatePaymentLinkInput,
  ): Promise<{ url: string; id: string }> {
    const result = await this.paymentGateway.createPaymentLink({
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
