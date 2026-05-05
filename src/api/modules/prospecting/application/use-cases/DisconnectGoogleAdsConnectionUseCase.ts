import { Inject, Injectable } from '@nestjs/common';
import {
  GOOGLE_ADS_CONNECTION_REPOSITORY,
  IGoogleAdsConnectionRepository,
} from '../../domain/repositories/IGoogleAdsConnectionRepository';

@Injectable()
export class DisconnectGoogleAdsConnectionUseCase {
  constructor(
    @Inject(GOOGLE_ADS_CONNECTION_REPOSITORY)
    private readonly repository: IGoogleAdsConnectionRepository,
  ) {}

  async execute(input: { tenantId: string }) {
    await this.repository.deleteByTenantId(input.tenantId);
    return {
      disconnected: true,
    };
  }
}
