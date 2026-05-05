import { SchedulingIntegrationHandlers } from '../application/handlers/SchedulingIntegrationHandlers';
import { ProfessionalSlotPaymentPendingIntegrationEvent } from '@modules/scheduling/domain/events/integration/ProfessionalSlotPaymentPendingIntegrationEvent';

describe('SchedulingIntegrationHandlers', () => {
  it('should queue the payment pending WhatsApp message', async () => {
    const eventBus = {
      subscribe: jest.fn(),
    };
    const messagingFacade = {
      queueSystemMessage: jest.fn(),
    };
    const handler = new SchedulingIntegrationHandlers(
      eventBus as any,
      messagingFacade as any,
    );

    handler.onModuleInit();
    const schedulingHandler = eventBus.subscribe.mock.calls.find(
      ([queue]) => queue === 'scheduling.professional_slot.payment_pending',
    )?.[1];

    await schedulingHandler(
      new ProfessionalSlotPaymentPendingIntegrationEvent({
        tenantId: 'tenant-1',
        contactId: 'contact-1',
        professionalName: 'Dra. Helena',
        categoryName: 'Consulta online',
        date: '2030-07-20',
        startsAt: '19:00',
        endsAt: '20:00',
        branchId: 'branch-1',
        paymentUrl: 'https://pay.test/link',
        expiresAt: '2030-07-20T22:00:00.000Z',
      }),
    );

    expect(messagingFacade.queueSystemMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        contactId: 'contact-1',
        channel: 'WHATSAPP',
        branchId: 'branch-1',
        text: expect.stringContaining('https://pay.test/link'),
      }),
    );
  });
});
