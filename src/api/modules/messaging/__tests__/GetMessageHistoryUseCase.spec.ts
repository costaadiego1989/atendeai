import { GetMessageHistoryUseCase } from '@modules/messaging/application/use-cases/GetMessageHistoryUseCase';
import { IConversationRepository } from '@modules/messaging/domain/repositories/IConversationRepository';
import { Message } from '@modules/messaging/domain/entities/Message';
import { MessageContent } from '@modules/messaging/domain/value-objects/MessageContent';
import { UniqueEntityID } from '@shared/domain/UniqueEntityID';

describe('GetMessageHistoryUseCase', () => {
  let useCase: GetMessageHistoryUseCase;
  let conversationRepository: jest.Mocked<IConversationRepository>;

  beforeEach(() => {
    conversationRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findByMessageId: jest.fn(),
      findByExternalMessageId: jest.fn(),
      findActiveByContact: jest.fn(),
      findLatestByContact: jest.fn(),
      findAllByTenant: jest.fn(),
      setAssignedUser: jest.fn(),
      findAssignedUsers: jest.fn(),
      findQueueState: jest.fn(),
      findMessagesByConversation: jest.fn(),
    } as unknown as jest.Mocked<IConversationRepository>;

    useCase = new GetMessageHistoryUseCase(conversationRepository);
  });

  it('should map paginated message history to the output contract', async () => {
    const message = Message.create(
      {
        conversationId: new UniqueEntityID('conversation-1'),
        direction: 'INBOUND',
        contentType: 'TEXT',
        content: MessageContent.create({ type: 'TEXT', text: 'Oi' }),
        sentBy: 'CONTACT',
      },
      new UniqueEntityID('message-1'),
    );

    conversationRepository.findMessagesByConversation.mockResolvedValue({
      data: [message],
      total: 3,
    });

    const result = await useCase.execute({
      conversationId: 'conversation-1',
      page: 2,
      limit: 2,
    });

    expect(conversationRepository.findMessagesByConversation).toHaveBeenCalledWith(
      'conversation-1',
      2,
      2,
    );
    expect(result.data).toEqual([
      expect.objectContaining({
        id: 'message-1',
        direction: 'INBOUND',
        contentType: 'TEXT',
        content: { type: 'TEXT', text: 'Oi', url: undefined, metadata: undefined },
        sentBy: 'CONTACT',
      }),
    ]);
    expect(result.meta).toEqual({
      total: 3,
      page: 2,
      limit: 2,
      totalPages: 2,
    });
  });

  it('should apply default pagination when page and limit are omitted', async () => {
    conversationRepository.findMessagesByConversation.mockResolvedValue({
      data: [],
      total: 0,
    });

    const result = await useCase.execute({
      conversationId: 'conversation-1',
    });

    expect(conversationRepository.findMessagesByConversation).toHaveBeenCalledWith(
      'conversation-1',
      1,
      50,
    );
    expect(result.meta).toEqual({
      total: 0,
      page: 1,
      limit: 50,
      totalPages: 0,
    });
  });
});
