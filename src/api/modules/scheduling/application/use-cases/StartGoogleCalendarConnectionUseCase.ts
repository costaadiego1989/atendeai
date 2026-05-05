import { Injectable } from '@nestjs/common';
import { GoogleCalendarOAuthService } from '../../infrastructure/services/GoogleCalendarOAuthService';
import { GoogleCalendarOAuthStateService } from '../../infrastructure/services/GoogleCalendarOAuthStateService';

@Injectable()
export class StartGoogleCalendarConnectionUseCase {
  constructor(
    private readonly oauthService: GoogleCalendarOAuthService,
    private readonly stateService: GoogleCalendarOAuthStateService,
  ) {}

  async execute(input: { tenantId: string; branchId?: string | null }) {
    const state = this.stateService.sign(
      input.branchId ? `${input.tenantId}:${input.branchId}` : input.tenantId,
    );
    return {
      authorizationUrl: this.oauthService.buildAuthorizationUrl(state),
    };
  }
}
