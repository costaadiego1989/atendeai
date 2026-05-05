import { Inject, Injectable } from '@nestjs/common';
import {
  SALES_METRICS_REPOSITORY,
  ISalesMetricsRepository,
} from '../../domain/repositories/ISalesRepository';

export interface TrackSalesMetricInput {
  tenantId: string;
  type: 'MESSAGE' | 'INTENT' | 'LINK';
  value?: number;
}

@Injectable()
export class TrackSalesMetricUseCase {
  constructor(
    @Inject(SALES_METRICS_REPOSITORY)
    private readonly salesRepository: ISalesMetricsRepository,
  ) {}

  async execute(input: TrackSalesMetricInput): Promise<void> {
    const today = new Date();
    await this.salesRepository.incrementMetric(
      input.tenantId,
      today,
      input.type,
      input.value,
    );
  }
}
