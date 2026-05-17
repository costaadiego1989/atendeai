import { Inject, Injectable } from '@nestjs/common';
import { Proposal } from '../../../domain/entities/Proposal';
import { IProposalRepository } from '../../../domain/ports/IProposalRepository';
import { ProposalNotFoundError } from '../../../domain/errors/ProposalNotFoundError';

@Injectable()
export class GetProposalService {
  constructor(
    @Inject('IProposalRepository')
    private readonly proposalRepository: IProposalRepository,
  ) {}

  async execute(id: string): Promise<Proposal> {
    const proposal = await this.proposalRepository.findById(id);
    if (!proposal) throw new ProposalNotFoundError(id);
    return proposal;
  }
}
