import { Inject, Injectable } from '@nestjs/common';
import {
  GOOGLE_ADS_CONNECTION_REPOSITORY,
  IGoogleAdsConnectionRepository,
} from '../../domain/repositories/IGoogleAdsConnectionRepository';
import { GoogleAdsOAuthService } from '../../infrastructure/services/GoogleAdsOAuthService';
import { GoogleAdsOAuthStateService } from '../../infrastructure/services/GoogleAdsOAuthStateService';

@Injectable()
export class CompleteGoogleAdsConnectionUseCase {
  constructor(
    @Inject(GOOGLE_ADS_CONNECTION_REPOSITORY)
    private readonly repository: IGoogleAdsConnectionRepository,
    private readonly oauthService: GoogleAdsOAuthService,
    private readonly stateService: GoogleAdsOAuthStateService,
  ) {}

  async execute(input: { code: string; state: string }) {
    const payload = this.stateService.verify(input.state);
    const oauth = await this.oauthService.exchangeCodeForRefreshToken(
      input.code,
    );
    const now = new Date().toISOString();

    await this.repository.save({
      tenantId: payload.tenantId,
      googleEmail: oauth.email,
      refreshToken: oauth.refreshToken,
      status: 'PENDING_ACCOUNT_SELECTION',
      connectedAt: now,
      updatedAt: now,
    });

    return {
      tenantId: payload.tenantId,
      email: oauth.email,
    };
  }
}
