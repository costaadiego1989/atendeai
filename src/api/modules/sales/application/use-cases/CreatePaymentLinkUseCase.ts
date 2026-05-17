import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  ICreatePaymentLinkUseCase,
  CreatePaymentLinkInput,
  CreatePaymentLinkOutput,
} from './interfaces/ICreatePaymentLinkUseCase';
import {
  IPAYMENT_GATEWAY,
  IPaymentGateway,
} from '../../../payment/domain/ports/IPaymentGateway';
import {
  ITenantRepository,
  TENANT_REPOSITORY,
} from '../../../tenant/domain/repositories/ITenantRepository';
import { SalesPaymentLinkLifecycleService } from '../services/SalesPaymentLinkLifecycleService';
import { StructuredLogEmitter } from '@shared/infrastructure/observability/StructuredLogEmitter';

@Injectable()
export class CreatePaymentLinkUseCase implements ICreatePaymentLinkUseCase {
  constructor(
    @Inject(IPAYMENT_GATEWAY)
    private readonly paymentProvider: IPaymentGateway,
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepository: ITenantRepository,
    private readonly paymentLinkLifecycleService: SalesPaymentLinkLifecycleService,
    private readonly structuredLog: StructuredLogEmitter,
  ) {}

  async execute(
    input: CreatePaymentLinkInput,
  ): Promise<CreatePaymentLinkOutput> {
    const tenant = await this.tenantRepository.findById(input.tenantId);
    if (!tenant) {
      throw new NotFoundException(`Tenant ${input.tenantId} not found`);
    }

    const paymentLinkRecordId = randomUUID();
    const externalReference = `sales-link|${input.tenantId}|${paymentLinkRecordId}`;
    const dueDateLimitDays = this.resolveDueDateLimitDays(input.expiresAt);
    const recurrence = this.resolveRecurrence(input);

    let result: { id: string; url: string };
    try {
      result = await this.paymentProvider.createPaymentLink({
        name: input.name,
        description: input.description,
        value: input.value,
        externalReference,
        billingType:
          input.billingType === 'UNDEFINED' ? 'UNDEFINED' : input.billingType,
        chargeType: recurrence ? 'RECURRENT' : 'DETACHED',
        dueDateLimitDays,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message.slice(0, 400)
          : String(error).slice(0, 400);
      this.structuredLog.emit({
        level: 'warn',
        event: 'sales.payment_link.gateway_create_failed',
        message: 'Gateway falhou ao criar link de pagamento de vendas',
        tenantId: input.tenantId,
        attributes: {
          billing_type: input.billingType,
          amount_band: this.amountBand(input.value),
          recurrence: Boolean(recurrence),
          error_message: message,
        },
      });
      throw error;
    }

    const catalogItemId = input.catalogItemId?.trim() || null;
    const catalogItemSku = input.catalogItemSku?.trim() || null;
    const catalogItemName = input.catalogItemName?.trim() || null;

    const savedLink = await this.paymentLinkLifecycleService.recordCreated({
      id: paymentLinkRecordId,
      tenantId: input.tenantId,
      branchId: input.branchId ?? null,
      providerLinkId: result.id,
      externalId: externalReference,
      name: input.name,
      description: input.description,
      label: input.label,
      value: input.value,
      url: result.url,
      billingType: input.billingType,
      status: 'ACTIVE',
      source: input.source ?? 'MANUAL',
      resourceType: 'PAYMENT_LINK',
      contactId: null,
      conversationId: null,
      catalogItemId,
      catalogItemSku,
      catalogItemName,
      expiresAt: input.expiresAt ?? null,
      recurrenceEnabled: Boolean(recurrence),
      recurrenceFrequency: recurrence?.frequency ?? null,
      recurrenceStartDate: recurrence?.startDate ?? null,
      recurrenceEndDate: recurrence?.endDate ?? null,
      recurrenceTotalValue: recurrence?.totalValue ?? null,
      recurrenceNextRunAt: recurrence?.nextRunAt ?? null,
      deletedAt: null,
    });

    this.structuredLog.emit({
      level: 'info',
      event: 'sales.payment_link.created',
      message: 'Link de pagamento de vendas criado e persistido',
      tenantId: input.tenantId,
      attributes: {
        payment_link_record_id: savedLink.id,
        billing_type: input.billingType,
        amount_band: this.amountBand(input.value),
        source: savedLink.source,
        has_catalog_sku: Boolean(catalogItemSku),
      },
    });

    return {
      id: savedLink.id,
      url: savedLink.url,
      name: savedLink.name,
      description: savedLink.description ?? undefined,
      label: savedLink.label ?? undefined,
      value: savedLink.value,
      billingType: savedLink.billingType,
      status: savedLink.status,
      source: savedLink.source,
      catalogItemId: savedLink.catalogItemId ?? undefined,
      catalogItemSku: savedLink.catalogItemSku ?? undefined,
      catalogItemName: savedLink.catalogItemName ?? undefined,
      expiresAt: savedLink.expiresAt?.toISOString(),
      recurrence: savedLink.recurrenceEnabled
        ? {
            frequency: savedLink.recurrenceFrequency ?? undefined,
            startDate: savedLink.recurrenceStartDate?.toISOString(),
            endDate: savedLink.recurrenceEndDate?.toISOString(),
            totalValue: savedLink.recurrenceTotalValue,
            nextRunAt: savedLink.recurrenceNextRunAt?.toISOString(),
          }
        : undefined,
      createdAt: savedLink.createdAt.toISOString(),
    };
  }

  private resolveDueDateLimitDays(expiresAt?: Date): number | undefined {
    if (!expiresAt) {
      return 3;
    }

    const today = new Date();
    const startOfToday = Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate(),
    );
    const endDate = Date.UTC(
      expiresAt.getUTCFullYear(),
      expiresAt.getUTCMonth(),
      expiresAt.getUTCDate(),
    );
    const diffInMs = endDate - startOfToday;
    const diffInDays = Math.ceil(diffInMs / (1000 * 60 * 60 * 24));
    return Math.max(1, diffInDays);
  }

  private resolveRecurrence(input: CreatePaymentLinkInput): {
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
      input.recurrence.startDate ?? input.expiresAt ?? new Date();
    const endDate = input.recurrence.endDate;

    if (!endDate) {
      throw new BadRequestException('Data final da recorrência e obrigatoria');
    }

    if (endDate < startDate) {
      throw new BadRequestException(
        'Data final da recorrência deve ser posterior ao inicio',
      );
    }

    return {
      frequency,
      startDate,
      endDate,
      totalValue: Number(
        (
          input.value * this.countOccurrences(startDate, endDate, frequency)
        ).toFixed(2),
      ),
      nextRunAt: this.computeNextRunAt(startDate, endDate, frequency),
    };
  }

  private computeNextRunAt(
    startDate: Date,
    endDate: Date,
    frequency: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY',
  ): Date | null {
    const nextRunAt = this.addFrequency(startDate, frequency);
    return nextRunAt <= endDate ? nextRunAt : null;
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

  /** Faixa grossa para logs sem expor valor exato (LGPD / anti-vazamento em traces). */
  private amountBand(value: number): string {
    if (!Number.isFinite(value)) {
      return 'unknown';
    }
    if (value < 50) {
      return 'lt_50';
    }
    if (value < 200) {
      return '50_199';
    }
    if (value < 1000) {
      return '200_999';
    }
    return 'gte_1000';
  }
}
