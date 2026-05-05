import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  ISchedulingGoogleCalendarConnectionRepository,
  SCHEDULING_GOOGLE_CALENDAR_CONNECTION_REPOSITORY,
} from '../../domain/ports/ISchedulingGoogleCalendarConnectionRepository';
import { GoogleCalendarOAuthService } from '../../infrastructure/services/GoogleCalendarOAuthService';

@Injectable()
export class ListGoogleCalendarCalendarsUseCase {
  constructor(
    @Inject(SCHEDULING_GOOGLE_CALENDAR_CONNECTION_REPOSITORY)
    private readonly repository: ISchedulingGoogleCalendarConnectionRepository,
    private readonly oauthService: GoogleCalendarOAuthService,
  ) {}

  async execute(input: { tenantId: string; branchId?: string | null }) {
    const connection = await this.repository.findBestForScope(input.tenantId, input.branchId);
    if (!connection) {
      throw new NotFoundException('Google Calendar is not connected');
    }

    const calendars = await this.oauthService.listCalendars(connection.refreshToken);

    return calendars.map((calendar) => ({
      ...calendar,
      selected: calendar.id === connection.calendarId,
    }));
  }
}
