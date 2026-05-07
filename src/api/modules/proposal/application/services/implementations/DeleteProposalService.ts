import { Inject, Injectable } from '@nestjs/common';
import { IProposalRepository } from '../../../domain/ports/IProposalRepository';
import { ProposalNotFoundError } from '../../../domain/errors/ProposalNotFoundError';

@Injectable()
export class DeleteProposalService {
  constructor(
    @Inject('IProposalRepository')
    private readonly proposalRepository: IProposalRepository,
  ) { }

  async execute(id: string): Promise<void> {
    const proposal = await this.proposalRepository.findById(id);
    if (!proposal) throw new ProposalNotFoundError(id);
    await this.proposalRepository.delete(id);
  }
}
