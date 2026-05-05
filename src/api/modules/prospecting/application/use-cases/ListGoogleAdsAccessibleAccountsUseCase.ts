import { Inject, Injectable } from '@nestjs/common';
import { ValidationErrorException } from '@shared/domain/exceptions/DomainExceptions';
import {
  GOOGLE_ADS_CONNECTION_REPOSITORY,
  IGoogleAdsConnectionRepository,
} from '../../domain/repositories/IGoogleAdsConnectionRepository';
import { GoogleAdsOAuthService } from '../../infrastructure/services/GoogleAdsOAuthService';

@Injectable()
export class ListGoogleAdsAccessibleAccountsUseCase {
  constructor(
    @Inject(GOOGLE_ADS_CONNECTION_REPOSITORY)
    private readonly repository: IGoogleAdsConnectionRepository,
    private readonly oauthService: GoogleAdsOAuthService,
  ) {}

  async execute(input: { tenantId: string }) {
    const connection = await this.repository.findByTenantId(input.tenantId);
    if (!connection) {
      throw new ValidationErrorException(
        'Google Ads ainda não foi conectado para este tenant',
      );
    }

    return this.oauthService.listAccessibleAccounts(connection.refreshToken);
  }
}
