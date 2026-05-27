import { Injectable } from '@nestjs/common';
import { PaymentService } from '../../application/services/PaymentService';
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
} from '../../application/facades/IPaymentFacade';

@Injectable()
export class PaymentFacadeAdapter implements IPaymentFacade {
  constructor(private readonly paymentService: PaymentService) {}

  async createPaymentLink(
    data: CreatePaymentLinkInput,
  ): Promise<PaymentLinkOutput> {
    const result = await this.paymentService.createPaymentLink({
      name: data.name,
      description: data.description,
      value: data.value,
      externalReference: data.externalReference,
      billingType: data.billingType,
      chargeType:
        data.chargeType === 'INSTALLMENT' ? 'DETACHED' : data.chargeType,
      dueDateLimitDays: data.dueDateLimitDays,
      maxInstallmentCount: data.maxInstallmentCount,
    });

    return { id: result.id, url: result.url };
  }

  async removePaymentLink(
    paymentLinkId: string,
  ): Promise<PaymentLinkStatusOutput> {
    const result = await this.paymentService.removePaymentLink(paymentLinkId);
    return { id: result.id, status: result.status };
  }

  async restorePaymentLink(
    paymentLinkId: string,
  ): Promise<PaymentLinkStatusOutput> {
    const result = await this.paymentService.restorePaymentLink(paymentLinkId);
    return { id: result.id, status: result.status };
  }

  async createPayment(data: CreatePaymentInput): Promise<PaymentOutput> {
    const result = await this.paymentService.createPayment({
      customer: data.customer,
      billingType: data.billingType,
      value: data.value,
      dueDate: data.dueDate,
      description: data.description,
      externalReference: data.externalReference,
      callback: data.callback,
      split: data.split,
    });

    return {
      id: result.id,
      status: result.status,
      value: result.value,
      billingType: result.billingType,
      dueDate: result.dueDate,
      invoiceUrl: result.invoiceUrl,
      externalReference: result.externalReference,
    };
  }

  async deletePayment(paymentId: string): Promise<PaymentLinkStatusOutput> {
    const result = await this.paymentService.deletePayment(paymentId);
    return { id: result.id, status: result.status };
  }

  async restorePayment(paymentId: string): Promise<PaymentLinkStatusOutput> {
    const result = await this.paymentService.restorePayment(paymentId);
    return { id: result.id, status: result.status };
  }

  async createCustomer(data: CreateCustomerInput): Promise<CustomerOutput> {
    const result = await this.paymentService.createCustomer(data);
    return {
      id: result.id,
      name: result.name,
      cpfCnpj: result.cpfCnpj,
      email: result.email,
    };
  }

  async getCustomer(id: string): Promise<CustomerOutput> {
    const result = await this.paymentService.getCustomer(id);
    return {
      id: result.id,
      name: result.name,
      cpfCnpj: result.cpfCnpj,
      email: result.email,
    };
  }

  async createSubscription(
    data: CreateSubscriptionInput,
  ): Promise<SubscriptionOutput> {
    const result = await this.paymentService.createSubscription(data);
    return {
      id: result.id,
      status: result.status,
      value: result.value,
      billingType: result.billingType,
      nextDueDate: result.nextDueDate,
      invoiceUrl: result.invoiceUrl,
    };
  }

  async updateSubscription(
    id: string,
    data: UpdateSubscriptionInput,
  ): Promise<SubscriptionOutput> {
    const result = await this.paymentService.updateSubscription(id, data);
    return {
      id: result.id,
      status: result.status,
      value: result.value,
      billingType: result.billingType,
      nextDueDate: result.nextDueDate,
    };
  }

  async cancelSubscription(id: string): Promise<SubscriptionOutput> {
    const result = await this.paymentService.cancelSubscription(id);
    return {
      id: result.id,
      status: result.status,
      value: result.value,
      billingType: result.billingType,
      nextDueDate: result.nextDueDate,
    };
  }

  async getSubscription(id: string): Promise<SubscriptionOutput> {
    const result = await this.paymentService.getSubscription(id);
    return {
      id: result.id,
      status: result.status,
      value: result.value,
      billingType: result.billingType,
      nextDueDate: result.nextDueDate,
      invoiceUrl: result.invoiceUrl,
    };
  }

  async createSubaccount(
    data: CreateSubaccountInput,
  ): Promise<SubaccountOutput> {
    const result = await this.paymentService.createSubaccount(data);
    return {
      id: result.id,
      walletId: result.walletId,
      email: result.email,
      cpfCnpj: result.cpfCnpj,
      status: result.status,
    };
  }

  async listSubaccounts(): Promise<SubaccountOutput[]> {
    const results = await this.paymentService.listSubaccounts();
    return results.map((item) => ({
      id: item.id,
      walletId: item.walletId,
      email: item.email,
      cpfCnpj: item.cpfCnpj,
      status: item.status,
    }));
  }
}
