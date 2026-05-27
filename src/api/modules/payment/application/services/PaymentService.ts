import { Inject, Injectable } from '@nestjs/common';
import {
  IPaymentGateway,
  IPAYMENT_GATEWAY,
  CreateCustomerData,
  CustomerResult,
  CreateSubscriptionData,
  SubscriptionResult,
  UpdateSubscriptionData,
  CreateSubaccountData,
  SubaccountResult,
  CreatePaymentData,
  PaymentResult,
  CreatePaymentLinkData,
  PaymentLinkResult,
} from '../../domain/ports/IPaymentGateway';

@Injectable()
export class PaymentService {
  constructor(
    @Inject(IPAYMENT_GATEWAY)
    private readonly provider: IPaymentGateway,
  ) {}

  async createCustomer(data: CreateCustomerData): Promise<CustomerResult> {
    return this.provider.createCustomer(data);
  }

  async createSubaccount(
    data: CreateSubaccountData,
  ): Promise<SubaccountResult> {
    return this.provider.createSubaccount(data);
  }

  async listSubaccounts(): Promise<SubaccountResult[]> {
    return this.provider.listSubaccounts();
  }

  async createSubscription(
    data: CreateSubscriptionData,
  ): Promise<SubscriptionResult> {
    return this.provider.createSubscription(data);
  }

  async cancelSubscription(
    subscriptionId: string,
  ): Promise<SubscriptionResult> {
    return this.provider.cancelSubscription(subscriptionId);
  }

  async updateSubscription(
    subscriptionId: string,
    data: UpdateSubscriptionData,
  ): Promise<SubscriptionResult> {
    return this.provider.updateSubscription(subscriptionId, data);
  }

  async createPaymentLink(
    data: CreatePaymentLinkData,
  ): Promise<PaymentLinkResult> {
    return this.provider.createPaymentLink(data);
  }

  async removePaymentLink(paymentLinkId: string) {
    return this.provider.removePaymentLink(paymentLinkId);
  }

  async restorePaymentLink(paymentLinkId: string) {
    return this.provider.restorePaymentLink(paymentLinkId);
  }

  async createPayment(data: CreatePaymentData): Promise<PaymentResult> {
    return this.provider.createPayment(data);
  }

  async deletePayment(paymentId: string) {
    return this.provider.deletePayment(paymentId);
  }

  async restorePayment(paymentId: string) {
    return this.provider.restorePayment(paymentId);
  }

  async getCustomer(id: string): Promise<CustomerResult> {
    return this.provider.getCustomer(id);
  }

  async getSubscription(subscriptionId: string): Promise<SubscriptionResult> {
    return this.provider.getSubscription(subscriptionId);
  }
}
