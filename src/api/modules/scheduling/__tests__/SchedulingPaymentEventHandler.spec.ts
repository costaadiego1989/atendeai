import { PaymentConfirmedIntegrationEvent } from '@modules/payment/application/integration-events/PaymentIntegrationEvents';
import { SchedulingPaymentEventHandler } from '../application/handlers/SchedulingPaymentEventHandler';
import { ProfessionalSlotPaymentConfirmedIntegrationEvent } from '../domain/events/integration/ProfessionalSlotPaymentConfirmedIntegrationEvent';

describe('SchedulingPaymentEventHandler', () => {
  const confirmedSlot = {
    id: 'slot-1',
    startsAt: '19:00',
    endsAt: '20:00',
    status: 'RESERVED' as const,
    reservedFor: {
      contactId: 'contact-1',
      contactName: 'Paciente Agendado',
      categoryName: 'Consulta online',
      isOnline: true,
    },
    payment: {
      reference: 'scheduling|tenant-1|professional-1|2030-07-20|slot-1',
      linkId: 'link-1',
      linkUrl: 'https://pay.example/x',
      amount: 230,
      billingType: 'PIX' as const,
      status: 'PAID' as const,
    },
  };

  it('should persist and publish Google Meet link after paid online reservation confirmation', async () => {
    const rawReference = 'scheduling|tenant-1|professional-1|2030-07-20|slot-1';

    const eventBus = {
      publish: jest.fn(),
      subscribe: jest.fn(),
    };
    const schedulingStore = {
      markSlotPaymentConfirmedByReference: jest
        .fn()
        .mockResolvedValue({ slot: confirmedSlot, appliedChange: true }),
      listProfessionals: jest.fn().mockResolvedValue([
        {
          id: 'professional-1',
          name: 'Dra. Helena',
          branchId: 'branch-1',
        },
      ]),
      attachMeetingLinkToReservedSlot: jest.fn().mockResolvedValue({
        ...confirmedSlot,
        reservedFor: {
          ...confirmedSlot.reservedFor,
          meetingProvider: 'GOOGLE_MEET',
          meetingUrl: 'https://meet.google.com/abc-defg-hij',
        },
      }),
    };
    const googleCalendarSyncService = {
      syncReservation: jest.fn().mockResolvedValue({
        meetingUrl: 'https://meet.google.com/abc-defg-hij',
      }),
    };
    const messagingFacade = {
      queueSystemMessage: jest.fn(),
    };
    const schedulingReminderQueue = {
      addJob: jest.fn(),
    };
    const structuredLog = { emit: jest.fn() };
    const configService = {
      get: jest.fn((_k: string) => undefined),
    };

    const handler = new SchedulingPaymentEventHandler(
      eventBus as any,
      schedulingStore as any,
      googleCalendarSyncService as any,
      messagingFacade as any,
      schedulingReminderQueue as any,
      structuredLog as any,
      configService as any,
    );

    handler.onModuleInit();
    const paymentConfirmedHandler = eventBus.subscribe.mock.calls.find(
      ([queue]) => queue === 'payment.confirmed',
    )?.[1];

    await paymentConfirmedHandler(
      new PaymentConfirmedIntegrationEvent({
        tenantId: 'tenant-1',
        paymentId: 'payment-1',
        amount: 230,
        confirmedAt: new Date('2030-07-20T19:05:00.000Z'),
        rawReference,
      }),
    );

    expect(
      schedulingStore.markSlotPaymentConfirmedByReference,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        professionalId: 'professional-1',
        date: '2030-07-20',
        slotId: 'slot-1',
        paymentReference: rawReference,
      }),
    );
    expect(
      schedulingStore.attachMeetingLinkToReservedSlot,
    ).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      professionalId: 'professional-1',
      date: '2030-07-20',
      slotId: 'slot-1',
      meetingProvider: 'GOOGLE_MEET',
      meetingUrl: 'https://meet.google.com/abc-defg-hij',
    });
    expect(messagingFacade.queueSystemMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        contactId: 'contact-1',
        channel: 'WHATSAPP',
        branchId: 'branch-1',
        text: expect.stringContaining(
          'Link do Google Meet: https://meet.google.com/abc-defg-hij',
        ),
      }),
    );
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.any(ProfessionalSlotPaymentConfirmedIntegrationEvent),
    );
    expect(eventBus.publish.mock.calls[0][0].payload).toEqual(
      expect.objectContaining({
        contactId: 'contact-1',
        meetingUrl: 'https://meet.google.com/abc-defg-hij',
      }),
    );
    expect(schedulingReminderQueue.addJob).toHaveBeenCalledTimes(3);
    expect(structuredLog.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'scheduling.payment_confirmed.pipeline_completed',
      }),
    );
  });

  it('should skip side effects when payment webhook is replayed (idempotent)', async () => {
    const rawReference = 'scheduling|tenant-1|professional-1|2030-07-20|slot-1';

    const eventBus = {
      publish: jest.fn(),
      subscribe: jest.fn(),
    };
    const schedulingStore = {
      markSlotPaymentConfirmedByReference: jest.fn().mockResolvedValue({
        slot: confirmedSlot,
        appliedChange: false,
      }),
      listProfessionals: jest.fn(),
      attachMeetingLinkToReservedSlot: jest.fn(),
    };
    const googleCalendarSyncService = {
      syncReservation: jest.fn(),
    };
    const messagingFacade = {
      queueSystemMessage: jest.fn(),
    };
    const schedulingReminderQueue = {
      addJob: jest.fn(),
    };
    const structuredLog = { emit: jest.fn() };
    const configService = {
      get: jest.fn((_k: string) => undefined),
    };

    const handler = new SchedulingPaymentEventHandler(
      eventBus as any,
      schedulingStore as any,
      googleCalendarSyncService as any,
      messagingFacade as any,
      schedulingReminderQueue as any,
      structuredLog as any,
      configService as any,
    );

    handler.onModuleInit();
    const paymentConfirmedHandler = eventBus.subscribe.mock.calls.find(
      ([queue]) => queue === 'payment.confirmed',
    )?.[1];

    await paymentConfirmedHandler(
      new PaymentConfirmedIntegrationEvent({
        tenantId: 'tenant-1',
        paymentId: 'payment-1',
        amount: 230,
        confirmedAt: new Date('2030-07-20T19:05:00.000Z'),
        rawReference,
      }),
    );

    expect(googleCalendarSyncService.syncReservation).not.toHaveBeenCalled();
    expect(messagingFacade.queueSystemMessage).not.toHaveBeenCalled();
    expect(eventBus.publish).not.toHaveBeenCalled();
    expect(schedulingReminderQueue.addJob).not.toHaveBeenCalled();
    expect(structuredLog.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'scheduling.payment_confirmed.idempotent',
      }),
    );
  });
});
