import { Inject, Injectable } from '@nestjs/common';
import { Proposal } from '../../../domain/entities/Proposal';
import { IProposalRepository } from '../../../domain/ports/IProposalRepository';
import { ProposalTitle } from '../../../domain/value-objects/ProposalTitle';
import { ProposalItem } from '../../../domain/value-objects/ProposalItem';

export interface CreateProposalData {
  tenantId: string;
  contactId: string;
  userId: string;
  title: string;
  description?: string | null;
  benefits?: string | null;
  metadata?: Record<string, any> | null;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    description?: string;
  }>;
  validUntil?: Date | null;
}

@Injectable()
export class CreateProposalService {
  constructor(
    @Inject('IProposalRepository')
    private readonly proposalRepository: IProposalRepository,
  ) { }

  async execute(data: CreateProposalData): Promise<Proposal> {
    const title = ProposalTitle.create(data.title);
    const items = data.items.map(item => ProposalItem.create({
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      description: item.description,
    }));

    const proposal = Proposal.create({
      tenantId: data.tenantId,
      contactId: data.contactId,
      userId: data.userId,
      title,
      description: data.description,
      benefits: data.benefits,
      items,
      validUntil: data.validUntil,
      metadata: data.metadata,
    });

    await this.proposalRepository.save(proposal);
    return proposal;
  }
}
