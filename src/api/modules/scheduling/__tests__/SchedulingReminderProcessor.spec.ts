import { SchedulingReminderProcessor } from '../infrastructure/queue/SchedulingReminderProcessor';

describe('SchedulingReminderProcessor', () => {
  let schedulingStore: any;
  let messagingFacade: any;
  let structuredLog: any;
  let processor: SchedulingReminderProcessor;

  beforeEach(() => {
    schedulingStore = {
      getAvailabilitySlot: jest.fn(),
      listProfessionals: jest.fn(),
    };
    messagingFacade = {
      queueSystemMessage: jest.fn(),
    };
    structuredLog = {
      emit: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    processor = new SchedulingReminderProcessor(schedulingStore, messagingFacade, structuredLog);
  });

  it('should send reminder with Google Meet link when slot is still reserved', async () => {
    schedulingStore.getAvailabilitySlot.mockResolvedValue({
      id: 'slot-1',
      startsAt: '14:00',
      endsAt: '15:00',
      status: 'RESERVED',
      reservedFor: {
        contactId: 'contact-1',
        categoryName: 'Consulta online',
        meetingUrl: 'https://meet.google.com/abc-defg-hij',
      },
    });
    schedulingStore.listProfessionals.mockResolvedValue([
      { id: 'professional-1', name: 'Dra. Ana' },
    ]);

    await processor.process({
      name: 'send-scheduling-reminder',
      data: {
        tenantId: 'tenant-1',
        branchId: 'branch-1',
        professionalId: 'professional-1',
        date: '2026-05-10',
        slotId: 'slot-1',
        offsetHours: 3,
        runAt: '2026-05-10T14:00:00.000Z',
      },
    } as any);

    expect(messagingFacade.queueSystemMessage).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      contactId: 'contact-1',
      channel: 'WHATSAPP',
      branchId: 'branch-1',
      text: expect.stringContaining('https://meet.google.com/abc-defg-hij'),
    });
  });

  it('should skip stale or unconfirmed reservations', async () => {
    schedulingStore.getAvailabilitySlot.mockResolvedValue({
      id: 'slot-1',
      startsAt: '14:00',
      endsAt: '15:00',
      status: 'PRE_RESERVED',
      reservedFor: {
        contactId: 'contact-1',
      },
    });

    await processor.process({
      name: 'send-scheduling-reminder',
      data: {
        tenantId: 'tenant-1',
        professionalId: 'professional-1',
        date: '2026-05-10',
        slotId: 'slot-1',
        offsetHours: 1,
        runAt: '2026-05-10T14:00:00.000Z',
      },
    } as any);

    expect(messagingFacade.queueSystemMessage).not.toHaveBeenCalled();
  });
});
