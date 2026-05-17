import { Inject, Injectable } from '@nestjs/common';
import {
  ISalesMetricsRepository,
  ISalesPaymentLinksRepository,
  SALES_METRICS_REPOSITORY,
  SALES_PAYMENT_LINKS_REPOSITORY,
  SalesPaymentLinkRecord,
} from '../../domain/repositories/ISalesRepository';
import { EVENT_BUS, IEventBus } from '@shared/application/ports/IEventBus';
import { SalesPaymentLinkCreatedIntegrationEvent } from '../integration-events/SalesIntegrationEvents';

type PaymentLinkRecordInput = Omit<
  SalesPaymentLinkRecord,
  'createdAt' | 'updatedAt'
>;

@Injectable()
export class SalesPaymentLinkLifecycleService {
  constructor(
    @Inject(SALES_PAYMENT_LINKS_REPOSITORY)
    private readonly paymentLinksRepository: ISalesPaymentLinksRepository,
    @Inject(SALES_METRICS_REPOSITORY)
    private readonly metricsRepository: ISalesMetricsRepository,
    @Inject(EVENT_BUS)
    private readonly eventBus: IEventBus,
  ) {}

  async recordCreated(
    input: PaymentLinkRecordInput,
  ): Promise<SalesPaymentLinkRecord> {
    const savedLink =
      await this.paymentLinksRepository.createPaymentLink(input);

    await this.metricsRepository.incrementMetric(
      input.tenantId,
      new Date(),
      'LINK',
      input.recurrenceTotalValue ?? input.value,
    );

    await this.eventBus.publish(
      new SalesPaymentLinkCreatedIntegrationEvent({
        tenantId: input.tenantId,
        paymentLinkId: input.providerLinkId,
        url: input.url,
        name: input.name,
        value: input.value,
        billingType: input.billingType,
        catalogItemId: input.catalogItemId ?? null,
        catalogItemSku: input.catalogItemSku ?? null,
        catalogItemName: input.catalogItemName ?? null,
      }),
    );

    return savedLink;
  }
}
