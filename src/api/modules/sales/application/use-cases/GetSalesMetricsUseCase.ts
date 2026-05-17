import { Inject, Injectable } from '@nestjs/common';
import {
  ISalesMetricsRepository,
  SALES_METRICS_REPOSITORY,
} from '../../domain/repositories/ISalesRepository';

export interface GetSalesMetricsInput {
  tenantId: string;
  startDate: Date;
  endDate: Date;
}

export interface GetSalesMetricsOutput {
  metrics: {
    date: string;
    totalMessages: number;
    purchaseIntents: number;
    paymentLinksGenerated: number;
    estimatedRevenue: number;
  }[];
  summary: {
    totalMessages: number;
    totalIntents: number;
    totalLinks: number;
    totalRevenue: number;
  };
}

@Injectable()
export class GetSalesMetricsUseCase {
  constructor(
    @Inject(SALES_METRICS_REPOSITORY)
    private readonly salesRepository: ISalesMetricsRepository,
  ) {}

  async execute(input: GetSalesMetricsInput): Promise<GetSalesMetricsOutput> {
    const metrics = await this.salesRepository.getMetrics(
      input.tenantId,
      input.startDate,
      input.endDate,
    );

    const summary = {
      totalMessages: 0,
      totalIntents: 0,
      totalLinks: 0,
      totalRevenue: 0,
    };

    const formattedMetrics = metrics.map((m) => {
      summary.totalMessages += m.totalMessages;
      summary.totalIntents += m.purchaseIntents;
      summary.totalLinks += m.paymentLinksGenerated;
      summary.totalRevenue += m.estimatedRevenue;

      return {
        date: m.date.toISOString(),
        totalMessages: m.totalMessages,
        purchaseIntents: m.purchaseIntents,
        paymentLinksGenerated: m.paymentLinksGenerated,
        estimatedRevenue: m.estimatedRevenue,
      };
    });

    return {
      metrics: formattedMetrics,
      summary,
    };
  }
}
