import { Inject, Injectable } from '@nestjs/common';
import { Proposal } from '../../../domain/entities/Proposal';
import { IProposalRepository } from '../../../domain/ports/IProposalRepository';

@Injectable()
export class ListProposalsService {
  constructor(
    @Inject('IProposalRepository')
    private readonly proposalRepository: IProposalRepository,
  ) {}

  async execute(tenantId: string): Promise<Proposal[]> {
    return this.proposalRepository.findByTenantId(tenantId);
  }
}
