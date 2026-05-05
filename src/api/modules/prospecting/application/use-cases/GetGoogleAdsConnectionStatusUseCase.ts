import { Inject, Injectable } from '@nestjs/common';
import {
  GOOGLE_ADS_CONNECTION_REPOSITORY,
  IGoogleAdsConnectionRepository,
} from '../../domain/repositories/IGoogleAdsConnectionRepository';

@Injectable()
export class GetGoogleAdsConnectionStatusUseCase {
  constructor(
    @Inject(GOOGLE_ADS_CONNECTION_REPOSITORY)
    private readonly repository: IGoogleAdsConnectionRepository,
  ) {}

  async execute(input: { tenantId: string }) {
    const connection = await this.repository.findByTenantId(input.tenantId);

    return {
      connected: Boolean(connection),
      status: connection?.status ?? 'NOT_CONNECTED',
      googleEmail: connection?.googleEmail,
      customerId: connection?.customerId,
      customerName: connection?.customerName,
      loginCustomerId: connection?.loginCustomerId,
      accountSelected: Boolean(connection?.customerId),
      connectedAt: connection?.connectedAt,
      updatedAt: connection?.updatedAt,
    };
  }
}
