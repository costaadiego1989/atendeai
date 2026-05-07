import { Inject, Injectable } from '@nestjs/common';
import { IMessagingFacade, MESSAGING_FACADE } from '@modules/messaging/application/facades/MessagingFacade';
import { ProposalNotFoundError } from '../../../domain/errors/ProposalNotFoundError';
import { IProposalRepository } from '../../../domain/ports/IProposalRepository';
import { buildProposalDeliveryMessage } from '../../support/proposal-message';
import { normalizeProposalMetadata } from '../../support/proposal-public-access';
import { ProposalPublicLinkService } from './ProposalPublicLinkService';

@Injectable()
export class SendProposalToConversationService {
  constructor(
    @Inject('IProposalRepository')
    private readonly proposalRepository: IProposalRepository,
    private readonly proposalPublicLinkService: ProposalPublicLinkService,
    @Inject(MESSAGING_FACADE)
    private readonly messagingFacade: IMessagingFacade,
  ) {}

  async execute(
    proposalId: string,
  ): Promise<{ conversationId: string; messageId: string; publicUrl: string }> {
    const proposal = await this.proposalRepository.findById(proposalId);
    if (!proposal) {
      throw new ProposalNotFoundError(proposalId);
    }

    const { publicUrl } = await this.proposalPublicLinkService.ensurePublicLink(proposal);

    const result = await this.messagingFacade.queueSystemMessage({
      tenantId: proposal.tenantId,
      contactId: proposal.contactId,
      channel: 'WHATSAPP',
      text: buildProposalDeliveryMessage({
        title: proposal.title,
        publicUrl,
      }),
    });

    const metadata = normalizeProposalMetadata(proposal.metadata);
    metadata.commercial.publicAccess.conversationId = result.conversationId;
    metadata.commercial.publicAccess.messageId = result.messageId;
    metadata.commercial.publicAccess.sentAt = new Date().toISOString();
    proposal.setMetadata(metadata);
    proposal.updateStatus('SENT');
    await this.proposalRepository.update(proposal);

    return {
      ...result,
      publicUrl,
    };
  }
}
