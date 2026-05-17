import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  IMessagingFacade,
  MESSAGING_FACADE,
} from '@modules/messaging/application/facades/MessagingFacade';
import { IProposalRepository } from '@modules/proposal/domain/ports/IProposalRepository';
import { buildProposalDeliveryMessage } from '@modules/proposal/application/support/proposal-message';
import { normalizeProposalMetadata } from '@modules/proposal/application/support/proposal-public-access';
import { ProposalPublicLinkService } from '@modules/proposal/application/services/implementations/ProposalPublicLinkService';

export interface SendProposalJobPayload {
  proposalId: string;
}

@Processor('proposal-delivery')
export class ProposalAsyncJobProcessor extends WorkerHost {
  private readonly logger = new Logger(ProposalAsyncJobProcessor.name);

  constructor(
    @Inject('IProposalRepository')
    private readonly proposalRepository: IProposalRepository,
    @Inject(MESSAGING_FACADE)
    private readonly messagingFacade: IMessagingFacade,
    private readonly proposalPublicLinkService: ProposalPublicLinkService,
  ) {
    super();
  }

  async process(job: Job<SendProposalJobPayload>): Promise<void> {
    if (job.name !== 'send-proposal') {
      return;
    }

    const { proposalId } = job.data;
    const proposal = await this.proposalRepository.findById(proposalId);

    if (!proposal) {
      this.logger.error(`Proposal ${proposalId} not found for delivery`);
      return;
    }

    try {
      const { publicUrl } =
        await this.proposalPublicLinkService.ensurePublicLink(proposal);

      this.logger.log(
        `Delivering proposal ${proposalId} to contact ${proposal.contactId}`,
      );

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
    } catch (error) {
      this.logger.error(
        `Failed to deliver proposal ${proposalId}: ${error.message}`,
      );
      throw error;
    }
  }
}
