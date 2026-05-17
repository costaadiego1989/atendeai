import { Inject, Injectable } from '@nestjs/common';
import { ValidationErrorException } from '@shared/domain/exceptions/DomainExceptions';
import {
  GOOGLE_ADS_CONNECTION_REPOSITORY,
  IGoogleAdsConnectionRepository,
} from '../../domain/repositories/IGoogleAdsConnectionRepository';
import { GoogleAdsOAuthService } from '../../infrastructure/services/GoogleAdsOAuthService';

@Injectable()
export class SelectGoogleAdsAccountUseCase {
  constructor(
    @Inject(GOOGLE_ADS_CONNECTION_REPOSITORY)
    private readonly repository: IGoogleAdsConnectionRepository,
    private readonly oauthService: GoogleAdsOAuthService,
  ) {}

  async execute(input: { tenantId: string; customerId: string }) {
    const connection = await this.repository.findByTenantId(input.tenantId);
    if (!connection) {
      throw new ValidationErrorException(
        'Google Ads ainda não foi conectado para este tenant',
      );
    }

    const accounts = await this.oauthService.listAccessibleAccounts(
      connection.refreshToken,
    );
    const selected = accounts.find(
      (account) => account.customerId === input.customerId,
    );
    if (!selected) {
      throw new ValidationErrorException(
        'A conta escolhida não esta acessivel para esta conexão Google Ads',
      );
    }

    const updatedAt = new Date().toISOString();
    const updatedConnection = {
      ...connection,
      status: 'CONNECTED' as const,
      customerId: selected.customerId,
      customerName: selected.descriptiveName,
      loginCustomerId: selected.isManager ? selected.customerId : undefined,
      updatedAt,
    };

    await this.repository.save(updatedConnection);

    return {
      connected: true,
      status: updatedConnection.status,
      googleEmail: updatedConnection.googleEmail,
      customerId: updatedConnection.customerId,
      customerName: updatedConnection.customerName,
      loginCustomerId: updatedConnection.loginCustomerId,
      accountSelected: true,
      connectedAt: updatedConnection.connectedAt,
      updatedAt: updatedConnection.updatedAt,
    };
  }
}
