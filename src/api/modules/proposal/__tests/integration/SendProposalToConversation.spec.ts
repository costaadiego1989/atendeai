import { ProposalPublicLinkService } from '../../application/services/implementations/ProposalPublicLinkService';
import { SendProposalToConversationService } from '../../application/services/implementations/SendProposalToConversationService';
import {
  buildProposal,
  createMessagingFacadeMock,
  InMemoryProposalRepository,
} from '../../__tests__/proposal-test-utils';

describe('SendProposalToConversationService', () => {
  it('creates a public proposal link and queues the message in the conversation', async () => {
    const repository = new InMemoryProposalRepository();
    const messagingFacadeMock = createMessagingFacadeMock();
    const proposalPublicLinkService = new ProposalPublicLinkService(
      repository as any,
      {
        get: (key: string) => {
          if (key === 'APP_PUBLIC_BASE_URL') return 'https://app.test';
          if (key === 'JWT_ACCESS_SECRET') return 'test-secret';
          return undefined;
        },
      } as any,
    );
    const sendProposalToConversationService =
      new SendProposalToConversationService(
        repository as any,
        proposalPublicLinkService,
        messagingFacadeMock as any,
      );

    const proposal = buildProposal({
      id: 'proposal-send-1',
    });
    repository.seed(proposal);

    const result = await sendProposalToConversationService.execute(proposal.id);

    expect(messagingFacadeMock.queueSystemMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: proposal.tenantId,
        contactId: proposal.contactId,
        channel: 'WHATSAPP',
        text: expect.stringContaining('https://app.test/proposal/'),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        conversationId: 'conversation-123',
        messageId: 'message-123',
        publicUrl: expect.stringContaining('https://app.test/proposal/'),
      }),
    );
  });
});
