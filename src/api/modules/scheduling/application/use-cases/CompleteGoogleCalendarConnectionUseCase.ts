import { Inject, Injectable } from '@nestjs/common';
import {
  ISchedulingGoogleCalendarConnectionRepository,
  SCHEDULING_GOOGLE_CALENDAR_CONNECTION_REPOSITORY,
} from '../../domain/ports/ISchedulingGoogleCalendarConnectionRepository';
import { GoogleCalendarOAuthService } from '../../infrastructure/services/GoogleCalendarOAuthService';
import { GoogleCalendarOAuthStateService } from '../../infrastructure/services/GoogleCalendarOAuthStateService';

@Injectable()
export class CompleteGoogleCalendarConnectionUseCase {
  constructor(
    @Inject(SCHEDULING_GOOGLE_CALENDAR_CONNECTION_REPOSITORY)
    private readonly repository: ISchedulingGoogleCalendarConnectionRepository,
    private readonly oauthService: GoogleCalendarOAuthService,
    private readonly stateService: GoogleCalendarOAuthStateService,
  ) {}

  async execute(input: { code: string; state: string }) {
    const payload = this.stateService.verify(input.state);
    const oauth = await this.oauthService.exchangeCodeForRefreshToken(input.code);
    const now = new Date().toISOString();

    await this.repository.save({
      tenantId: payload.tenantId,
      branchId: payload.branchId ?? null,
      googleEmail: oauth.email,
      refreshToken: oauth.refreshToken,
      calendarId: 'primary',
      status: 'CONNECTED',
      connectedAt: now,
      updatedAt: now,
    });

    return {
      tenantId: payload.tenantId,
      email: oauth.email,
    };
  }
}
