import { Inject, Injectable } from '@nestjs/common';
import {
  ISchedulingGoogleCalendarConnectionRepository,
  SCHEDULING_GOOGLE_CALENDAR_CONNECTION_REPOSITORY,
} from '../../domain/ports/ISchedulingGoogleCalendarConnectionRepository';

@Injectable()
export class GetGoogleCalendarConnectionStatusUseCase {
  constructor(
    @Inject(SCHEDULING_GOOGLE_CALENDAR_CONNECTION_REPOSITORY)
    private readonly repository: ISchedulingGoogleCalendarConnectionRepository,
  ) {}

  async execute(input: { tenantId: string; branchId?: string | null }) {
    const exactConnection = await this.repository.findByScope(input.tenantId, input.branchId);
    const connection = await this.repository.findBestForScope(input.tenantId, input.branchId);

    return {
      connected: Boolean(connection),
      status: connection?.status ?? 'NOT_CONNECTED',
      googleEmail: connection?.googleEmail,
      calendarId: connection?.calendarId,
      scope: connection
        ? exactConnection
          ? input.branchId
            ? 'BRANCH'
            : 'TENANT'
          : 'TENANT'
        : 'NONE',
      connectedAt: connection?.connectedAt,
      updatedAt: connection?.updatedAt,
    };
  }
}
