import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  ISchedulingGoogleCalendarConnectionRepository,
  SCHEDULING_GOOGLE_CALENDAR_CONNECTION_REPOSITORY,
} from '../../domain/ports/ISchedulingGoogleCalendarConnectionRepository';
import { GoogleCalendarOAuthService } from '../../infrastructure/services/GoogleCalendarOAuthService';

@Injectable()
export class SelectGoogleCalendarUseCase {
  constructor(
    @Inject(SCHEDULING_GOOGLE_CALENDAR_CONNECTION_REPOSITORY)
    private readonly repository: ISchedulingGoogleCalendarConnectionRepository,
    private readonly oauthService: GoogleCalendarOAuthService,
  ) {}

  async execute(input: {
    tenantId: string;
    branchId?: string | null;
    calendarId: string;
  }) {
    const connection = await this.repository.findBestForScope(
      input.tenantId,
      input.branchId,
    );
    if (!connection) {
      throw new NotFoundException('Google Calendar is not connected');
    }

    const calendars = await this.oauthService.listCalendars(
      connection.refreshToken,
    );
    const selected = calendars.find(
      (calendar) => calendar.id === input.calendarId,
    );
    if (!selected) {
      throw new NotFoundException(
        'Google Calendar id not found for this account',
      );
    }

    const updatedAt = new Date().toISOString();
    await this.repository.save({
      ...connection,
      branchId: input.branchId ?? null,
      calendarId: input.calendarId,
      updatedAt,
    });

    return {
      connected: true,
      status: connection.status,
      googleEmail: connection.googleEmail,
      calendarId: input.calendarId,
      scope: input.branchId ? 'BRANCH' : 'TENANT',
      connectedAt: connection.connectedAt,
      updatedAt,
    };
  }
}
