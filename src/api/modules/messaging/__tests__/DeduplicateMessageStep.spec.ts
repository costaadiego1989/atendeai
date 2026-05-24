import { DeduplicateMessageStep } from '../application/services/inbound-pipeline/DeduplicateMessageStep';
import { InboundMessageContext } from '../application/services/inbound-pipeline/InboundMessageContext';
import { IConversationRepository } from '../domain/repositories/IConversationRepository';

describe('DeduplicateMessageStep', () => {
  let step: DeduplicateMessageStep;
  let conversationRepository: jest.Mocked<IConversationRepository>;

  const baseInput: InboundMessageContext['input'] = {
    tenantId: 'tenant-1',
    branchId: null,
    externalMessageId: 'ext-1',
    fromPhone: '+5511999999999',
    toPhone: '+5511888888888',
    contentType: 'text',
    content: { text: 'Oi' },
    channel: 'WHATSAPP',
  };

  beforeEach(() => {
    conversationRepository = {
      findByExternalMessageId: jest.fn(),
    } as unknown as jest.Mocked<IConversationRepository>;

    step = new DeduplicateMessageStep(conversationRepository);
  });

  it('should look up duplicates scoped by tenant and within the caller transaction', async () => {
    const tx = {} as any;
    conversationRepository.findByExternalMessageId.mockResolvedValue(null);

    const ctx: InboundMessageContext = {
      input: baseInput,
      tx,
      events: [],
    };

    const result = await step.execute(ctx);

    expect(
      conversationRepository.findByExternalMessageId,
    ).toHaveBeenCalledWith('ext-1', 'tenant-1', { tx });
    expect(result.isDuplicate).toBe(false);
  });

  it('should flag duplicates when an existing message is found', async () => {
    conversationRepository.findByExternalMessageId.mockResolvedValue({} as any);

    const result = await step.execute({
      input: baseInput,
      events: [],
    });

    expect(result.isDuplicate).toBe(true);
  });

  it('should skip the duplicate check when requested', async () => {
    const result = await step.execute({
      input: baseInput,
      skipDuplicateCheck: true,
      events: [],
    });

    expect(
      conversationRepository.findByExternalMessageId,
    ).not.toHaveBeenCalled();
    expect(result.isDuplicate).toBe(false);
  });
});
