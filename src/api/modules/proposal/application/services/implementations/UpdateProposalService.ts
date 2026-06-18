import { Inject, Injectable } from '@nestjs/common';
import { Proposal } from '../../../domain/entities/Proposal';
import { IProposalRepository } from '../../../domain/ports/IProposalRepository';
import { ProposalTitle } from '../../../domain/value-objects/ProposalTitle';
import { ProposalItem } from '../../../domain/value-objects/ProposalItem';
import { ProposalNotFoundError } from '../../../domain/errors/ProposalNotFoundError';

interface UpdateProposalData {
  title?: string;
  description?: string | null;
  benefits?: string | null;
  metadata?: Record<string, any> | null;
  validUntil?: Date | null;
  items?: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    description?: string;
  }>;
}

@Injectable()
export class UpdateProposalService {
  constructor(
    @Inject('IProposalRepository')
    private readonly proposalRepository: IProposalRepository,
  ) {}

  async execute(
    id: string,
    data: UpdateProposalData,
    tenantId: string,
  ): Promise<Proposal> {
    const proposal = await this.proposalRepository.findById(id, tenantId);
    if (!proposal) throw new ProposalNotFoundError(id);

    if (data.title) {
      (proposal as any)._props.title = ProposalTitle.create(data.title);
    }

    if (data.items) {
      const items = data.items.map((item: any) =>
        ProposalItem.create({
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          description: item.description,
        }),
      );
      proposal.updateItems(items);
    }

    if (data.description !== undefined)
      (proposal as any)._props.description = data.description;
    if (data.benefits !== undefined)
      (proposal as any)._props.benefits = data.benefits;
    if (data.validUntil !== undefined)
      (proposal as any)._props.validUntil = data.validUntil;
    if (data.metadata !== undefined)
      (proposal as any)._props.metadata = data.metadata;

    await this.proposalRepository.update(proposal);
    return proposal;
  }
}
