import { DomainException } from '@shared/domain/exceptions/DomainExceptions';

export class ProposalItemUnitPriceInvalidError extends DomainException {
  constructor() {
    super(
      'O valor unitário do item da proposta não pode ser negativo.',
      'PROPOSAL_ITEM_UNIT_PRICE_INVALID',
    );
  }
}
