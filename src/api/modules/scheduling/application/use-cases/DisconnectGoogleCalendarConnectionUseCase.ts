import { Inject, Injectable } from '@nestjs/common';
import {
  ISchedulingGoogleCalendarConnectionRepository,
  SCHEDULING_GOOGLE_CALENDAR_CONNECTION_REPOSITORY,
} from '../../domain/ports/ISchedulingGoogleCalendarConnectionRepository';

@Injectable()
export class DisconnectGoogleCalendarConnectionUseCase {
  constructor(
    @Inject(SCHEDULING_GOOGLE_CALENDAR_CONNECTION_REPOSITORY)
    private readonly repository: ISchedulingGoogleCalendarConnectionRepository,
  ) {}

  async execute(input: { tenantId: string; branchId?: string | null }) {
    await this.repository.deleteByScope(input.tenantId, input.branchId);

    return {
      disconnected: true,
    };
  }
}
