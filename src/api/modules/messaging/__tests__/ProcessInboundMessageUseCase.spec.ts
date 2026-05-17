import { ProcessInboundMessageUseCase } from '@modules/messaging/application/use-cases/ProcessInboundMessageUseCase';
import { MessageReceivedIntegrationEvent } from '@modules/messaging/application/integration-events/publishers/MessageReceivedIntegrationEvent';
import { PrismaTransactionalEventPublisher } from '@shared/infrastructure/event-bus/PrismaTransactionalEventPublisher';

describe('ProcessInboundMessageUseCase', () => {
  let sut: ProcessInboundMessageUseCase;
  let transactionalEventPublisher: jest.Mocked<PrismaTransactionalEventPublisher>;
  let pipeline: { execute: jest.Mock };

  beforeEach(() => {
    transactionalEventPublisher = {
      execute: jest.fn(async (work: any) => {
        const outcome = await work({} as any);
        return outcome.result;
      }),
    } as any;
    pipeline = {
      execute: jest.fn(),
    };

    sut = new ProcessInboundMessageUseCase(
      transactionalEventPublisher,
      pipeline as any,
    );
  });

  it('should delegate to the pipeline via transactionalEventPublisher on execute', async () => {
    pipeline.execute.mockResolvedValue([
      new MessageReceivedIntegrationEvent(
        {
          conversationId: 'conversation-1',
          tenantId: 'tenant-1',
          contactId: 'contact-1',
          branchId: 'branch-1',
          messageId: 'message-1',
          content: { type: 'TEXT', text: 'Oi, tudo bem?' },
          channel: 'WHATSAPP',
        },
        'messaging:inbound:external-msg-1',
      ),
    ]);

    await sut.execute({
      tenantId: 'tenant-1',
      externalMessageId: 'external-msg-1',
      fromPhone: '5511999990000',
      toPhone: '5511888880000',
      contentType: 'text',
      content: { text: 'Oi, tudo bem?' },
      channel: 'WHATSAPP',
    });

    expect(transactionalEventPublisher.execute).toHaveBeenCalledTimes(1);
    expect(pipeline.execute).toHaveBeenCalledWith(
      {
        tenantId: 'tenant-1',
        externalMessageId: 'external-msg-1',
        fromPhone: '5511999990000',
        toPhone: '5511888880000',
        contentType: 'text',
        content: { text: 'Oi, tudo bem?' },
        channel: 'WHATSAPP',
      },
      { tx: expect.any(Object) },
    );
  });

  it('should call pipeline.execute directly from persistInboundMessage', async () => {
    const mockEvent = new MessageReceivedIntegrationEvent(
      {
        conversationId: 'conversation-1',
        tenantId: 'tenant-1',
        contactId: 'contact-1',
        branchId: null,
        messageId: 'message-2',
        content: { type: 'TEXT', text: 'Oi' },
        channel: 'WHATSAPP',
      },
      'messaging:inbound:external-msg-2',
    );
    pipeline.execute.mockResolvedValue([mockEvent]);

    const events = await sut.persistInboundMessage({
      tenantId: 'tenant-1',
      externalMessageId: 'external-msg-2',
      fromPhone: '5511999990000',
      toPhone: '5511888880000',
      contentType: 'text',
      content: { text: 'Oi' },
      channel: 'WHATSAPP',
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(MessageReceivedIntegrationEvent);
    expect(pipeline.execute).toHaveBeenCalledWith(
      expect.objectContaining({ externalMessageId: 'external-msg-2' }),
      undefined,
    );
  });

  it('should return empty array from persistInboundMessage when pipeline returns empty', async () => {
    pipeline.execute.mockResolvedValue([]);

    const events = await sut.persistInboundMessage({
      tenantId: 'tenant-1',
      externalMessageId: 'external-msg-dup',
      fromPhone: '5511999990000',
      toPhone: '5511888880000',
      contentType: 'text',
      content: { text: 'Oi' },
      channel: 'WHATSAPP',
    });

    expect(events).toEqual([]);
  });
});
