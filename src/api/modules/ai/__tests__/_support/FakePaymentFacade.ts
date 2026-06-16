import {
  CreateCustomerInput,
  CreatePaymentInput,
  CreatePaymentLinkInput,
  CreateSubaccountInput,
  CreateSubscriptionInput,
  CustomerOutput,
  IPaymentFacade,
  PaymentLinkOutput,
  PaymentLinkStatusOutput,
  PaymentOutput,
  SubaccountOutput,
  SubscriptionOutput,
  UpdateSubscriptionInput,
} from '@modules/payment/application/facades/IPaymentFacade';

export class FakePaymentFacade implements IPaymentFacade {
  public createdLinks: CreatePaymentLinkInput[] = [];
  private seq = 0;

  async createPaymentLink(
    data: CreatePaymentLinkInput,
  ): Promise<PaymentLinkOutput> {
    this.createdLinks.push(data);
    this.seq += 1;
    return {
      id: `fake-link-${this.seq}`,
      url: `https://pay.test/link/${this.seq}`,
    };
  }

  async removePaymentLink(
    paymentLinkId: string,
  ): Promise<PaymentLinkStatusOutput> {
    return { id: paymentLinkId, status: 'REMOVED' };
  }

  async restorePaymentLink(
    paymentLinkId: string,
  ): Promise<PaymentLinkStatusOutput> {
    return { id: paymentLinkId, status: 'ACTIVE' };
  }

  async createPayment(data: CreatePaymentInput): Promise<PaymentOutput> {
    this.seq += 1;
    return {
      id: `fake-pay-${this.seq}`,
      status: 'PENDING',
      value: data.value,
      billingType: data.billingType,
      dueDate: data.dueDate,
      invoiceUrl: `https://pay.test/charge/${this.seq}`,
      externalReference: data.externalReference,
    };
  }

  async deletePayment(paymentId: string): Promise<PaymentLinkStatusOutput> {
    return { id: paymentId, status: 'DELETED' };
  }

  async restorePayment(paymentId: string): Promise<PaymentLinkStatusOutput> {
    return { id: paymentId, status: 'ACTIVE' };
  }

  async createCustomer(data: CreateCustomerInput): Promise<CustomerOutput> {
    this.seq += 1;
    return {
      id: `fake-cus-${this.seq}`,
      name: data.name,
      cpfCnpj: data.cpfCnpj,
      email: data.email,
    };
  }

  async getCustomer(id: string): Promise<CustomerOutput> {
    return { id, name: 'Fake Customer' };
  }

  async createSubscription(
    data: CreateSubscriptionInput,
  ): Promise<SubscriptionOutput> {
    this.seq += 1;
    return {
      id: `fake-sub-${this.seq}`,
      status: 'ACTIVE',
      value: data.value,
      billingType: data.billingType,
      nextDueDate: data.nextDueDate,
      invoiceUrl: `https://pay.test/sub/${this.seq}`,
    };
  }

  async updateSubscription(
    id: string,
    data: UpdateSubscriptionInput,
  ): Promise<SubscriptionOutput> {
    return {
      id,
      status: 'ACTIVE',
      value: data.value ?? 0,
      billingType: data.billingType ?? 'PIX',
      nextDueDate: data.nextDueDate ?? new Date().toISOString(),
    };
  }

  async cancelSubscription(id: string): Promise<SubscriptionOutput> {
    return {
      id,
      status: 'CANCELLED',
      value: 0,
      billingType: 'PIX',
      nextDueDate: new Date().toISOString(),
    };
  }

  async getSubscription(id: string): Promise<SubscriptionOutput> {
    return {
      id,
      status: 'ACTIVE',
      value: 0,
      billingType: 'PIX',
      nextDueDate: new Date().toISOString(),
    };
  }

  async createSubaccount(
    data: CreateSubaccountInput,
  ): Promise<SubaccountOutput> {
    this.seq += 1;
    return {
      id: `fake-acc-${this.seq}`,
      walletId: `fake-wallet-${this.seq}`,
      email: data.email,
      cpfCnpj: data.cpfCnpj,
      status: 'ACTIVE',
    };
  }

  async listSubaccounts(): Promise<SubaccountOutput[]> {
    return [];
  }
}
