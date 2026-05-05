import { Injectable } from '@nestjs/common';
import { GoogleAdsOAuthService } from '../../infrastructure/services/GoogleAdsOAuthService';
import { GoogleAdsOAuthStateService } from '../../infrastructure/services/GoogleAdsOAuthStateService';

@Injectable()
export class StartGoogleAdsConnectionUseCase {
  constructor(
    private readonly oauthService: GoogleAdsOAuthService,
    private readonly stateService: GoogleAdsOAuthStateService,
  ) {}

  async execute(input: { tenantId: string }) {
    const state = this.stateService.sign(input.tenantId);
    return {
      authorizationUrl: this.oauthService.buildAuthorizationUrl(state),
    };
  }
}
