import { DomainException } from '@shared/domain/exceptions/DomainExceptions';

export class ProposalItemNameRequiredError extends DomainException {
  constructor() {
    super('O nome do item da proposta é obrigatório.', 'PROPOSAL_ITEM_NAME_REQUIRED');
  }
}
