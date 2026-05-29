import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import axiosRetry from 'axios-retry';
import { parseRecoveryPaymentReference } from '@shared/contracts/payment-references';
import {
  PaymentGatewayConflictException,
  PaymentGatewayNotFoundException,
  PaymentGatewayUnavailableException,
  PaymentGatewayValidationException,
  PaymentGatewayAuthenticationException,
} from '../../domain/exceptions/PaymentGatewayExceptions';
import {
  IPaymentGateway,
  CreateCustomerData,
  CustomerResult,
  CreateSubaccountData,
  SubaccountResult,
  CreateSubscriptionData,
  SubscriptionResult,
  UpdateSubscriptionData,
  CreatePaymentData,
  PaymentResult,
  CreatePaymentLinkData,
  PaymentLinkResult,
  PaymentLinkStatusResult,
  ParsedWebhookEvent,
  WebhookEventType,
} from '../../domain/ports/IPaymentGateway';

@Injectable()
export class AsaasAdapter implements IPaymentGateway {
  private readonly logger = new Logger(AsaasAdapter.name);
  private readonly httpClient: AxiosInstance;

  constructor(private readonly configService: ConfigService) {
    const isSandbox =
      this.configService.get<string>('ASAAS_SANDBOX') === 'true';
    const rawApiKey = isSandbox
      ? this.configService.get<string>('ASAAS_API_KEY_SANDBOX')
      : this.configService.get<string>('ASAAS_API_KEY');
    const apiKey = rawApiKey?.startsWith('$$') ? rawApiKey.slice(1) : rawApiKey;
    const baseUrl = isSandbox
      ? this.configService.get<string>('ASAAS_BASE_URL_SANDBOX')
      : this.configService.get<string>('ASAAS_BASE_URL');

    this.httpClient = axios.create({
      baseURL:
        baseUrl ||
        (isSandbox
          ? 'https://sandbox.asaas.com/api/v3'
          : 'https://www.asaas.com/api/v3'),
      headers: {
        access_token: apiKey || '',
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    axiosRetry(this.httpClient, {
      retries: 3,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error) => {
        return (
          axiosRetry.isNetworkOrIdempotentRequestError(error) ||
          (error.response ? error.response.status >= 500 : false)
        );
      },
    });
  }

  parseWebhook(payload: any, signature?: string): ParsedWebhookEvent | null {
    if (!payload || !payload.event || !payload.payment) return null;

    let eventType: WebhookEventType = 'UNKNOWN';
    switch (payload.event) {
      case 'PAYMENT_CONFIRMED':
      case 'PAYMENT_RECEIVED':
        eventType = 'PAYMENT_CONFIRMED';
        break;
      case 'PAYMENT_OVERDUE':
        eventType = 'PAYMENT_OVERDUE';
        break;
      case 'PAYMENT_REFUNDED':
      case 'PAYMENT_CHARGEBACK_REQUESTED':
        eventType = 'PAYMENT_REFUNDED';
        break;
      case 'SUBSCRIPTION_DELETED':
        eventType = 'SUBSCRIPTION_DELETED';
        break;
    }

    const occurredAt = this.extractOccurredAt(payload, eventType);

    return {
      provider: 'ASAAS',
      eventType,
      paymentId: payload.payment.id,
      tenantId: this.extractTenantId(payload.payment.externalReference),
      amount: payload.payment.value,
      occurredAt,
      rawReference: payload.payment.externalReference,
      rawPayload: payload,
    };
  }

  private extractOccurredAt(
    payload: any,
    eventType: WebhookEventType,
  ): Date | undefined {
    const payment = payload?.payment ?? {};
    const candidatesByEvent: Record<WebhookEventType, Array<unknown>> = {
      PAYMENT_RECEIVED: [
        payment.receivedDate,
        payment.clientPaymentDate,
        payment.paymentDate,
        payment.dateCreated,
        payload.dateCreated,
      ],
      PAYMENT_CONFIRMED: [
        payment.confirmedDate,
        payment.clientPaymentDate,
        payment.paymentDate,
        payment.dateCreated,
        payload.dateCreated,
      ],
      PAYMENT_OVERDUE: [
        payment.dueDate,
        payment.originalDueDate,
        payment.dateCreated,
        payload.dateCreated,
      ],
      PAYMENT_REFUNDED: [
        payment.refundedAt,
        payment.lastUpdated,
        payment.dateCreated,
        payload.dateCreated,
      ],
      SUBSCRIPTION_DELETED: [
        payload.deletedAt,
        payment.deletedAt,
        payment.lastUpdated,
        payment.dateCreated,
        payload.dateCreated,
      ],
      UNKNOWN: [payment.dateCreated, payload.dateCreated],
    };

    for (const candidate of candidatesByEvent[eventType] ?? []) {
      if (!candidate) {
        continue;
      }

      const parsedDate = new Date(candidate as string | number | Date);
      if (!Number.isNaN(parsedDate.getTime())) {
        return parsedDate;
      }
    }

    return undefined;
  }

  async createCustomer(data: CreateCustomerData): Promise<CustomerResult> {
    try {
      const response = await this.httpClient.post('/customers', {
        ...data,
        phone: this.normalizePhone(data.phone),
        mobilePhone: this.normalizeMobilePhone(data.mobilePhone ?? data.phone),
      });
      return {
        id: response.data.id,
        name: response.data.name,
        cpfCnpj: response.data.cpfCnpj,
        email: response.data.email,
      };
    } catch (error: any) {
      this.handleError('createCustomer', error);
    }
  }

  async getCustomer(id: string): Promise<CustomerResult> {
    try {
      const response = await this.httpClient.get(`/customers/${id}`);
      return {
        id: response.data.id,
        name: response.data.name,
        cpfCnpj: response.data.cpfCnpj,
        email: response.data.email,
      };
    } catch (error: any) {
      this.handleError('getCustomer', error);
    }
  }

  async createSubaccount(
    data: CreateSubaccountData,
  ): Promise<SubaccountResult> {
    try {
      const response = await this.httpClient.post('/accounts', {
        ...data,
        phone: this.normalizePhone(data.phone),
        mobilePhone: this.normalizeMobilePhone(data.mobilePhone),
      });
      return {
        id: response.data.id,
        walletId: response.data.walletId,
        email: response.data.email,
        cpfCnpj: response.data.cpfCnpj,
        status: response.data.generalApprovalStatus ?? response.data.status,
      };
    } catch (error: any) {
      this.handleError('createSubaccount', error);
    }
  }

  async listSubaccounts(): Promise<SubaccountResult[]> {
    try {
      const response = await this.httpClient.get('/accounts', {
        params: {
          limit: 100,
          offset: 0,
        },
      });

      const items = Array.isArray(response.data?.data)
        ? response.data.data
        : Array.isArray(response.data)
          ? response.data
          : [];

      return items.map((item: any) => ({
        id: item.id,
        walletId: item.walletId,
        email: item.email,
        cpfCnpj: item.cpfCnpj,
        status: item.generalApprovalStatus ?? item.status,
      }));
    } catch (error: any) {
      this.handleError('listSubaccounts', error);
    }
  }

  async createSubscription(
    data: CreateSubscriptionData,
  ): Promise<SubscriptionResult> {
    try {
      const response = await this.httpClient.post('/subscriptions', data);
      // Asaas returns invoiceUrl directly or in the first payment
      const invoiceUrl =
        response.data.invoiceUrl ||
        response.data.payment?.invoiceUrl ||
        response.data.paymentLink;
      return {
        id: response.data.id,
        status: response.data.status,
        value: response.data.value,
        billingType: response.data.billingType,
        nextDueDate: response.data.nextDueDate,
        invoiceUrl,
      };
    } catch (error: any) {
      this.handleError('createSubscription', error);
    }
  }

  async cancelSubscription(
    subscriptionId: string,
  ): Promise<SubscriptionResult> {
    try {
      const response = await this.httpClient.delete(
        `/subscriptions/${subscriptionId}`,
      );
      return {
        id: response.data.id,
        status: response.data.status,
        value: response.data.value,
        billingType: response.data.billingType,
        nextDueDate: response.data.nextDueDate,
      };
    } catch (error: any) {
      this.handleError('cancelSubscription', error);
    }
  }

  async updateSubscription(
    subscriptionId: string,
    data: UpdateSubscriptionData,
  ): Promise<SubscriptionResult> {
    try {
      const response = await this.httpClient.put(
        `/subscriptions/${subscriptionId}`,
        data,
      );
      return {
        id: response.data.id,
        status: response.data.status,
        value: response.data.value,
        billingType: response.data.billingType,
        nextDueDate: response.data.nextDueDate,
      };
    } catch (error: any) {
      this.handleError('updateSubscription', error);
    }
  }

  async getSubscription(subscriptionId: string): Promise<SubscriptionResult> {
    try {
      const response = await this.httpClient.get(
        `/subscriptions/${subscriptionId}`,
      );
      return {
        id: response.data.id,
        status: response.data.status,
        value: response.data.value,
        billingType: response.data.billingType,
        nextDueDate: response.data.nextDueDate,
      };
    } catch (error: any) {
      this.handleError('getSubscription', error);
    }
  }

  async createPaymentLink(
    data: CreatePaymentLinkData,
  ): Promise<PaymentLinkResult> {
    try {
      const response = await this.httpClient.post('/paymentLinks', data);
      return {
        id: response.data.id,
        url: response.data.url,
      };
    } catch (error: any) {
      this.handleError('createPaymentLink', error);
    }
  }

  async createPayment(data: CreatePaymentData): Promise<PaymentResult> {
    try {
      const response = await this.httpClient.post('/payments', data);
      return {
        id: response.data.id,
        status: response.data.status,
        value: response.data.value,
        billingType: response.data.billingType,
        dueDate: response.data.dueDate,
        invoiceUrl: response.data.invoiceUrl,
        externalReference: response.data.externalReference,
      };
    } catch (error: any) {
      this.handleError('createPayment', error);
    }
  }

  async deletePayment(paymentId: string): Promise<PaymentLinkStatusResult> {
    try {
      const response = await this.httpClient.delete(`/payments/${paymentId}`);
      return {
        id: response.data.id,
        status: response.data.deleted
          ? 'REMOVED'
          : (response.data.status ?? 'REMOVED'),
      };
    } catch (error: any) {
      this.handleError('deletePayment', error);
    }
  }

  async restorePayment(paymentId: string): Promise<PaymentLinkStatusResult> {
    try {
      const response = await this.httpClient.post(
        `/payments/${paymentId}/restore`,
      );
      return {
        id: response.data.id,
        status: response.data.status ?? 'ACTIVE',
      };
    } catch (error: any) {
      this.handleError('restorePayment', error);
    }
  }

  async removePaymentLink(
    paymentLinkId: string,
  ): Promise<PaymentLinkStatusResult> {
    try {
      const response = await this.httpClient.delete(
        `/paymentLinks/${paymentLinkId}`,
      );
      return {
        id: response.data.id,
        status: response.data.deleted
          ? 'REMOVED'
          : (response.data.status ?? 'REMOVED'),
      };
    } catch (error: any) {
      this.handleError('removePaymentLink', error);
    }
  }

  async restorePaymentLink(
    paymentLinkId: string,
  ): Promise<PaymentLinkStatusResult> {
    try {
      const response = await this.httpClient.post(
        `/paymentLinks/${paymentLinkId}/restore`,
      );
      return {
        id: response.data.id,
        status: response.data.status ?? 'ACTIVE',
      };
    } catch (error: any) {
      this.handleError('restorePaymentLink', error);
    }
  }

  private extractTenantId(rawReference?: string): string | undefined {
    if (!rawReference) {
      return undefined;
    }

    const recoveryParts = parseRecoveryPaymentReference(rawReference);
    if (recoveryParts) {
      return recoveryParts.tenantId;
    }

    const billingUpgradeMatch =
      /^billing-upgrade\|([^|]+)\|(ESSENCIAL|PROFISSIONAL|ESCALA)$/.exec(
        rawReference,
      );
    if (billingUpgradeMatch) {
      return billingUpgradeMatch[1];
    }

    const schedulingMatch =
      /^scheduling\|([^|]+)\|([^|]+)\|(\d{4}-\d{2}-\d{2})\|(.+)$/.exec(
        rawReference,
      );
    if (schedulingMatch) {
      return schedulingMatch[1];
    }

    const compactSchedulingMatch = /^sch\|([^|]+)\|([^|]+)\|(.+)$/.exec(
      rawReference,
    );
    if (compactSchedulingMatch) {
      return this.expandUuid(compactSchedulingMatch[1]);
    }

    const salesLinkMatch = /^sales-link\|([^|]+)\|([^|]+)$/.exec(rawReference);
    if (salesLinkMatch) {
      return salesLinkMatch[1];
    }

    const salesChargeMatch = /^sales-charge\|([^|]+)\|([^|]+)$/.exec(
      rawReference,
    );
    if (salesChargeMatch) {
      return salesChargeMatch[1];
    }

    if (rawReference.startsWith('trial|')) {
      return undefined;
    }

    return rawReference;
  }

  private expandUuid(value: string): string {
    if (/^[0-9a-fA-F]{32}$/.test(value)) {
      return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`.toLowerCase();
    }

    return value;
  }

  private handleError(method: string, error: any): never {
    const message =
      error.response?.data?.errors?.[0]?.description || error.message;
    const status = error.response?.status;
    const details = JSON.stringify(error.response?.data || {});

    this.logger.error(
      `AsaasAdapter.${method} failed [${status}]: ${message}`,
      details,
    );

    if (!status) {
      throw new PaymentGatewayUnavailableException(
        `Payment gateway unreachable: ${message}`,
        details,
      );
    }

    if (status === 404) {
      throw new PaymentGatewayNotFoundException(
        `Payment gateway resource not found: ${message}`,
        details,
      );
    }

    if (status === 409) {
      throw new PaymentGatewayConflictException(
        `Payment gateway conflict: ${message}`,
        details,
      );
    }

    if (status >= 500) {
      throw new PaymentGatewayUnavailableException(
        `Payment gateway unavailable [${status}]: ${message}`,
        details,
      );
    }

    if (status === 401) {
      throw new PaymentGatewayAuthenticationException(
        `Payment gateway authentication failed: ${message}`,
        details,
      );
    }

    throw new PaymentGatewayValidationException(
      `Payment gateway validation error [${status}]: ${message}`,
      details,
    );
  }

  private normalizePhone(phone?: string): string | undefined {
    if (!phone) {
      return undefined;
    }

    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('55') && digits.length >= 12) {
      return digits.slice(2);
    }

    return digits;
  }

  private normalizeMobilePhone(phone?: string): string | undefined {
    const normalized = this.normalizePhone(phone);
    if (!normalized) {
      return undefined;
    }

    if (normalized.length === 10) {
      return `${normalized.slice(0, 2)}9${normalized.slice(2)}`;
    }

    return normalized;
  }
}
