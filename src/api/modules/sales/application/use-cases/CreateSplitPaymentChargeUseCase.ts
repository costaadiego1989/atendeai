import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  IPaymentFacade,
  PAYMENT_FACADE,
} from '@modules/payment/application/facades/IPaymentFacade';
import {
  TENANT_FINANCIAL_ACCOUNT_REPOSITORY,
  ITenantFinancialAccountRepository,
} from '@modules/payment/domain/repositories/ITenantFinancialAccountRepository';
import {
  CONTACT_FINANCIAL_PROFILE_REPOSITORY,
  IContactFinancialProfileRepository,
} from '@modules/payment/domain/repositories/IContactFinancialProfileRepository';
import {
  CONTACT_FACADE,
  IContactFacade,
} from '@modules/contact/application/facades/ContactFacade';
import { SalesPaymentLinkLifecycleService } from '../services/SalesPaymentLinkLifecycleService';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import { SalesPaymentChargeCreatedIntegrationEvent } from '../../domain/events/integration/SalesPaymentChargeCreatedIntegrationEvent';

interface CreateSplitPaymentChargeInput {
  tenantId: string;
  branchId?: string | null;
  contactId: string;
  conversationId?: string | null;
  customerDocument?: string;
  name: string;
  value: number;
  description?: string;
  label?: string;
  billingType: 'PIX' | 'CREDIT_CARD' | 'BOLETO';
  dueDate?: Date;
  sendViaWhatsApp?: boolean;
  recurrence?: {
    frequency?: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
    startDate?: Date;
    endDate?: Date;
  };
}

@Injectable()
export class CreateSplitPaymentChargeUseCase {
  constructor(
    @Inject(PAYMENT_FACADE)
    private readonly paymentFacade: IPaymentFacade,
    @Inject(TENANT_FINANCIAL_ACCOUNT_REPOSITORY)
    private readonly tenantFinancialAccountRepository: ITenantFinancialAccountRepository,
    @Inject(CONTACT_FINANCIAL_PROFILE_REPOSITORY)
    private readonly contactFinancialProfileRepository: IContactFinancialProfileRepository,
    @Inject(CONTACT_FACADE)
    private readonly contactFacade: IContactFacade,
    @Inject(EVENT_BUS)
    private readonly eventBus: IEventBus,
    private readonly paymentLinkLifecycleService: SalesPaymentLinkLifecycleService,
  ) {}

  async execute(input: CreateSplitPaymentChargeInput) {
    if (input.value <= 0) {
      throw new BadRequestException('Charge value must be greater than zero');
    }

    const tenantFinancialAccount =
      await this.tenantFinancialAccountRepository.findByTenantId(
        input.tenantId,
      );
    if (!tenantFinancialAccount?.walletId) {
      throw new ConflictException(
        'Conta financeira da empresa ainda não foi configurada',
      );
    }

    const contact = await this.contactFacade.getContactById(
      input.tenantId,
      input.contactId,
    );
    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    const resolvedBranchId = input.branchId ?? contact.branchId ?? null;
    const recurrence = this.resolveRecurrence(input);

    const customerId = await this.ensureFinancialCustomer(
      input.tenantId,
      input.contactId,
      contact,
      input.customerDocument,
    );

    const paymentRecordId = randomUUID();
    const externalReference = `sales-charge|${input.tenantId}|${paymentRecordId}`;
    const dueDate = (input.dueDate ?? this.defaultDueDate())
      .toISOString()
      .slice(0, 10);
    const tenantPercentualValue = input.value < 100 ? 98 : 98.5;

    const payment = await this.paymentFacade.createPayment({
      customer: customerId,
      billingType: input.billingType,
      value: input.value,
      dueDate,
      description: input.description || input.name,
      externalReference,
      split: [
        {
          walletId: tenantFinancialAccount.walletId,
          percentualValue: tenantPercentualValue,
        },
      ],
    });

    if (input.sendViaWhatsApp) {
      await this.eventBus.publish(
        new SalesPaymentChargeCreatedIntegrationEvent({
          tenantId: input.tenantId,
          contactId: input.contactId,
          contactName: contact.name,
          invoiceUrl: payment.invoiceUrl,
          value: input.value,
          branchId: resolvedBranchId,
          conversationId: input.conversationId ?? null,
        }),
      );
    }

    const savedLink = await this.paymentLinkLifecycleService.recordCreated({
      id: paymentRecordId,
      tenantId: input.tenantId,
      branchId: resolvedBranchId,
      providerLinkId: payment.id,
      externalId: externalReference,
      name: input.name,
      description: input.description,
      label: input.label,
      value: input.value,
      url: payment.invoiceUrl,
      billingType: input.billingType,
      status: 'ACTIVE',
      source: 'MANUAL',
      resourceType: 'PAYMENT',
      contactId: input.contactId,
      conversationId: input.conversationId ?? null,
      expiresAt: input.dueDate ?? null,
      recurrenceEnabled: Boolean(recurrence),
      recurrenceFrequency: recurrence?.frequency ?? null,
      recurrenceStartDate: recurrence?.startDate ?? null,
      recurrenceEndDate: recurrence?.endDate ?? null,
      recurrenceTotalValue: recurrence?.totalValue ?? null,
      recurrenceNextRunAt: recurrence?.nextRunAt ?? null,
      deletedAt: null,
    });

    return {
      id: savedLink.id,
      paymentId: payment.id,
      url: payment.invoiceUrl,
      dueDate,
      contactId: input.contactId,
      conversationId: input.conversationId ?? null,
      tenantSplitPercent: tenantPercentualValue,
      platformFeePercent: Number((100 - tenantPercentualValue).toFixed(2)),
      status: savedLink.status,
      recurrence: savedLink.recurrenceEnabled
        ? {
            frequency: savedLink.recurrenceFrequency,
            startDate: savedLink.recurrenceStartDate?.toISOString(),
            endDate: savedLink.recurrenceEndDate?.toISOString(),
            totalValue: savedLink.recurrenceTotalValue,
            nextRunAt: savedLink.recurrenceNextRunAt?.toISOString(),
          }
        : undefined,
    };
  }

  private resolveRecurrence(input: CreateSplitPaymentChargeInput): {
    frequency: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
    startDate: Date;
    endDate: Date;
    totalValue: number;
    nextRunAt: Date | null;
  } | null {
    if (!input.recurrence) {
      return null;
    }

    const frequency = input.recurrence.frequency ?? 'MONTHLY';
    const startDate =
      input.recurrence.startDate ?? input.dueDate ?? this.defaultDueDate();
    const endDate = input.recurrence.endDate;

    if (!endDate) {
      throw new BadRequestException('Data final da recorrência e obrigatoria');
    }

    if (endDate < startDate) {
      throw new BadRequestException(
        'Data final da recorrência deve ser posterior ao inicio',
      );
    }

    const occurrences = this.countOccurrences(startDate, endDate, frequency);

    return {
      frequency,
      startDate,
      endDate,
      totalValue: Number((input.value * occurrences).toFixed(2)),
      nextRunAt: this.computeNextRunAt(startDate, endDate, frequency),
    };
  }

  private countOccurrences(
    startDate: Date,
    endDate: Date,
    frequency: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY',
  ): number {
    let occurrences = 0;
    let cursor = new Date(startDate);

    while (cursor <= endDate && occurrences < 240) {
      occurrences += 1;
      cursor = this.addFrequency(cursor, frequency);
    }

    return Math.max(1, occurrences);
  }

  private computeNextRunAt(
    startDate: Date,
    endDate: Date,
    frequency: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY',
  ): Date | null {
    const nextRunAt = this.addFrequency(startDate, frequency);
    return nextRunAt <= endDate ? nextRunAt : null;
  }

  private addFrequency(
    date: Date,
    frequency: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY',
  ): Date {
    const next = new Date(date);
    if (frequency === 'WEEKLY') {
      next.setUTCDate(next.getUTCDate() + 7);
      return next;
    }
    if (frequency === 'MONTHLY') {
      next.setUTCMonth(next.getUTCMonth() + 1);
      return next;
    }
    if (frequency === 'QUARTERLY') {
      next.setUTCMonth(next.getUTCMonth() + 3);
      return next;
    }
    next.setUTCFullYear(next.getUTCFullYear() + 1);
    return next;
  }

  private async ensureFinancialCustomer(
    tenantId: string,
    contactId: string,
    contact: { name: string; phone: string; document?: string; email?: string },
    customerDocument?: string,
  ): Promise<string> {
    const existing =
      await this.contactFinancialProfileRepository.findByTenantAndContact(
        tenantId,
        contactId,
      );
    if (existing) {
      return existing.asaasCustomerId;
    }

    const normalizedDocument =
      customerDocument?.replace(/\D/g, '') ||
      contact.document?.replace(/\D/g, '') ||
      '';
    if (!normalizedDocument) {
      throw new BadRequestException(
        'Informe o CPF ou CNPJ do cliente para criar a primeira cobrança',
      );
    }

    const customer = await this.paymentFacade.createCustomer({
      name: contact.name,
      cpfCnpj: normalizedDocument,
      email: contact.email,
      phone: contact.phone,
      mobilePhone: contact.phone,
      externalReference: `${tenantId}|${contactId}`,
    });

    await this.contactFinancialProfileRepository.save({
      id: randomUUID(),
      tenantId,
      contactId,
      provider: 'ASAAS',
      asaasCustomerId: customer.id,
    });

    return customer.id;
  }

  private defaultDueDate(): Date {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3);
    return dueDate;
  }
}
