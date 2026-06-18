import { Inject, Injectable } from '@nestjs/common';
import { IProposalRepository } from '../../../domain/ports/IProposalRepository';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ProposalNotFoundError } from '../../../domain/errors/ProposalNotFoundError';
import { ProposalInvalidScheduleDateError } from '../../../domain/errors/ProposalInvalidScheduleDateError';

@Injectable()
export class ScheduleProposalDeliveryService {
  constructor(
    @Inject('IProposalRepository')
    private readonly proposalRepository: IProposalRepository,
    @InjectQueue('proposal-delivery') private readonly deliveryQueue: Queue,
  ) {}

  async execute(
    id: string,
    scheduledAt: Date,
    tenantId: string,
  ): Promise<void> {
    const proposal = await this.proposalRepository.findById(id, tenantId);
    if (!proposal) throw new ProposalNotFoundError(id);

    if (scheduledAt <= new Date()) {
      throw new ProposalInvalidScheduleDateError();
    }

    proposal.markAsScheduled(scheduledAt);
    await this.proposalRepository.update(proposal);

    const delay = scheduledAt.getTime() - Date.now();
    await this.deliveryQueue.add(
      'send-proposal',
      { proposalId: id, tenantId },
      { delay: delay > 0 ? delay : 0, jobId: `send-proposal-${id}` },
    );
  }
}
