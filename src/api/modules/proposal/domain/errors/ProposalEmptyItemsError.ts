import { DomainException } from '@shared/domain/exceptions/DomainExceptions';

export class ProposalEmptyItemsError extends DomainException {
  constructor() {
    super('A proposta deve ter ao menos um item.', 'PROPOSAL_EMPTY_ITEMS');
  }
}
