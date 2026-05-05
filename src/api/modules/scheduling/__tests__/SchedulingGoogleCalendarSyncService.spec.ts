import { SchedulingGoogleCalendarSyncService } from '../application/services/SchedulingGoogleCalendarSyncService';
import { ISchedulingGoogleCalendarConnectionRepository } from '../domain/ports/ISchedulingGoogleCalendarConnectionRepository';
import {
  ISchedulingGoogleCalendarEventLinkRepository,
  SchedulingGoogleCalendarEventLink,
} from '../domain/ports/ISchedulingGoogleCalendarEventLinkRepository';
import { GoogleCalendarOAuthService } from '../infrastructure/services/GoogleCalendarOAuthService';

describe('SchedulingGoogleCalendarSyncService', () => {
  let service: SchedulingGoogleCalendarSyncService;
  let connectionRepository: jest.Mocked<ISchedulingGoogleCalendarConnectionRepository>;
  let eventLinkRepository: jest.Mocked<ISchedulingGoogleCalendarEventLinkRepository>;
  let oauthService: jest.Mocked<GoogleCalendarOAuthService>;

  beforeEach(() => {
    connectionRepository = {
      save: jest.fn(),
      findByScope: jest.fn(),
      findBestForScope: jest.fn(),
      deleteByScope: jest.fn(),
    };

    eventLinkRepository = {
      save: jest.fn(),
      findBySlot: jest.fn(),
      reassignSlot: jest.fn(),
      deleteBySlot: jest.fn(),
    };

    oauthService = {
      buildAuthorizationUrl: jest.fn(),
      exchangeCodeForRefreshToken: jest.fn(),
      getAccessToken: jest.fn(),
      createEvent: jest.fn(),
      listCalendars: jest.fn(),
      updateEvent: jest.fn(),
      deleteEvent: jest.fn(),
      ensurePlatformConfigured: jest.fn(),
      getClientId: jest.fn(),
      getClientSecret: jest.fn(),
      getRedirectUri: jest.fn(),
    } as unknown as jest.Mocked<GoogleCalendarOAuthService>;

    service = new SchedulingGoogleCalendarSyncService(
      connectionRepository,
      eventLinkRepository,
      oauthService,
    );
  });

  it('should create a Google Calendar event and persist branch scoped link data', async () => {
    connectionRepository.findBestForScope.mockResolvedValue({
      tenantId: 'tenant-1',
      branchId: 'branch-1',
      googleEmail: 'branch@test.com',
      refreshToken: 'refresh-token',
      calendarId: 'calendar-1',
      status: 'CONNECTED',
      connectedAt: '2026-04-09T12:00:00.000Z',
      updatedAt: '2026-04-09T12:00:00.000Z',
    });
    eventLinkRepository.findBySlot.mockResolvedValue(null);
    oauthService.createEvent.mockResolvedValue({ id: 'google-event-1' });

    await service.syncReservation({
      tenantId: 'tenant-1',
      branchId: 'branch-1',
      professionalId: 'professional-1',
      professionalName: 'Dra. Julia',
      date: '2026-04-10',
      slot: {
        id: 'slot-1',
        startsAt: '09:00',
        endsAt: '09:30',
        status: 'PRE_RESERVED',
        payment: {
          reference: 'sched-ref-1',
          linkId: 'link-1',
          linkUrl: 'https://pay.example.com/link-1',
          amount: 150,
          billingType: 'PIX',
          status: 'PENDING',
          expiresAt: '2026-04-10T12:00:00.000Z',
        },
        reservedFor: {
          contactName: 'Maria',
          contactPhone: '21999999999',
          contactEmail: 'maria@test.com',
          categoryName: 'Consulta',
          notes: 'Cliente pediu retorno rapido',
        },
      },
    });

    expect(oauthService.createEvent).toHaveBeenCalledWith(
      'refresh-token',
      'calendar-1',
      expect.objectContaining({
        summary: '[Pendente] Consulta - Maria',
        description: expect.stringContaining('Link de pagamento: https://pay.example.com/link-1'),
      }),
    );
    expect(eventLinkRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        branchId: 'branch-1',
        professionalId: 'professional-1',
        slotId: 'slot-1',
        eventId: 'google-event-1',
      }),
    );
  });

  it('should request a Google Meet link for online reservations', async () => {
    connectionRepository.findBestForScope.mockResolvedValue({
      tenantId: 'tenant-1',
      branchId: 'branch-1',
      googleEmail: 'branch@test.com',
      refreshToken: 'refresh-token',
      calendarId: 'calendar-1',
      status: 'CONNECTED',
      connectedAt: '2026-04-09T12:00:00.000Z',
      updatedAt: '2026-04-09T12:00:00.000Z',
    });
    eventLinkRepository.findBySlot.mockResolvedValue(null);
    oauthService.createEvent.mockResolvedValue({
      id: 'google-event-1',
      meetingUrl: 'https://meet.google.com/abc-defg-hij',
    });

    const result = await service.syncReservation({
      tenantId: 'tenant-1',
      branchId: 'branch-1',
      professionalId: 'professional-1',
      professionalName: 'Dra. Julia',
      date: '2026-04-10',
      createGoogleMeet: true,
      slot: {
        id: 'slot-1',
        startsAt: '09:00',
        endsAt: '09:30',
        status: 'RESERVED',
        reservedFor: {
          contactName: 'Maria',
          categoryName: 'Teleconsulta',
          isOnline: true,
        },
      },
    });

    expect(oauthService.createEvent).toHaveBeenCalledWith(
      'refresh-token',
      'calendar-1',
      expect.objectContaining({
        createGoogleMeet: true,
        summary: 'Teleconsulta - Maria',
      }),
    );
    expect(result).toEqual({
      meetingUrl: 'https://meet.google.com/abc-defg-hij',
    });
  });

  it('should update an existing Google Calendar event when the reservation already has a link', async () => {
    const existingLink: SchedulingGoogleCalendarEventLink = {
      tenantId: 'tenant-1',
      branchId: 'branch-1',
      professionalId: 'professional-1',
      date: '2026-04-10',
      slotId: 'slot-1',
      eventId: 'google-event-1',
      createdAt: '2026-04-09T12:00:00.000Z',
      updatedAt: '2026-04-09T12:00:00.000Z',
    };

    connectionRepository.findBestForScope.mockResolvedValue({
      tenantId: 'tenant-1',
      branchId: 'branch-1',
      googleEmail: 'branch@test.com',
      refreshToken: 'refresh-token',
      calendarId: 'calendar-1',
      status: 'CONNECTED',
      connectedAt: '2026-04-09T12:00:00.000Z',
      updatedAt: '2026-04-09T12:00:00.000Z',
    });
    eventLinkRepository.findBySlot.mockResolvedValue(existingLink);

    await service.syncReservation({
      tenantId: 'tenant-1',
      branchId: 'branch-1',
      professionalId: 'professional-1',
      professionalName: 'Dra. Julia',
      date: '2026-04-10',
      slot: {
        id: 'slot-1',
        startsAt: '10:00',
        endsAt: '10:30',
        status: 'RESERVED',
        reservedFor: {
          contactName: 'Maria',
          categoryName: 'Consulta',
        },
      },
    });

    expect(oauthService.updateEvent).toHaveBeenCalledWith(
      'refresh-token',
      'calendar-1',
      'google-event-1',
      expect.objectContaining({
        summary: 'Consulta - Maria',
      }),
    );
    expect(oauthService.createEvent).not.toHaveBeenCalled();
    expect(eventLinkRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'google-event-1',
      }),
    );
  });

  it('should keep the same Google Calendar event when a reservation is rescheduled', async () => {
    const existingLink: SchedulingGoogleCalendarEventLink = {
      tenantId: 'tenant-1',
      branchId: 'branch-1',
      professionalId: 'professional-1',
      date: '2026-04-10',
      slotId: 'slot-1',
      eventId: 'google-event-1',
      createdAt: '2026-04-09T12:00:00.000Z',
      updatedAt: '2026-04-09T12:00:00.000Z',
    };

    connectionRepository.findBestForScope.mockResolvedValue({
      tenantId: 'tenant-1',
      branchId: 'branch-1',
      googleEmail: 'branch@test.com',
      refreshToken: 'refresh-token',
      calendarId: 'calendar-1',
      status: 'CONNECTED',
      connectedAt: '2026-04-09T12:00:00.000Z',
      updatedAt: '2026-04-09T12:00:00.000Z',
    });
    eventLinkRepository.findBySlot.mockResolvedValue(existingLink);

    await service.rescheduleReservation({
      tenantId: 'tenant-1',
      branchId: 'branch-1',
      sourceProfessionalId: 'professional-1',
      sourceDate: '2026-04-10',
      sourceSlotId: 'slot-1',
      targetProfessionalId: 'professional-1',
      targetProfessionalName: 'Dra. Julia',
      targetDate: '2026-04-11',
      targetSlot: {
        id: 'slot-2',
        startsAt: '15:00',
        endsAt: '15:30',
        status: 'RESERVED',
        reservedFor: {
          contactName: 'Maria',
          categoryName: 'Consulta',
        },
      },
    });

    expect(oauthService.updateEvent).toHaveBeenCalledWith(
      'refresh-token',
      'calendar-1',
      'google-event-1',
      expect.objectContaining({
        summary: 'Consulta - Maria',
        startDateTime: '2026-04-11T15:00:00-03:00',
      }),
    );
    expect(eventLinkRepository.reassignSlot).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceDate: '2026-04-10',
        sourceSlotId: 'slot-1',
        targetDate: '2026-04-11',
        targetSlotId: 'slot-2',
      }),
    );
  });
});
