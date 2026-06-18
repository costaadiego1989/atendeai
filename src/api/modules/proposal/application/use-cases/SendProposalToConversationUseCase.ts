import { SendProposalToConversationService } from '../services/implementations/SendProposalToConversationService';

export class SendProposalToConversationUseCase {
  constructor(
    private readonly sendProposalToConversationService: SendProposalToConversationService,
  ) {}

  async execute(
    proposalId: string,
    tenantId: string,
  ): Promise<{ conversationId: string; messageId: string; publicUrl: string }> {
    return this.sendProposalToConversationService.execute(proposalId, tenantId);
  }
}
