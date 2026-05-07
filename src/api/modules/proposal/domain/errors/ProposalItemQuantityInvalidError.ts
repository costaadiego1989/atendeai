import { DomainException } from '@shared/domain/exceptions/DomainExceptions';

export class ProposalItemQuantityInvalidError extends DomainException {
  constructor() {
    super('A quantidade do item da proposta deve ser maior que zero.', 'PROPOSAL_ITEM_QUANTITY_INVALID');
  }
}
