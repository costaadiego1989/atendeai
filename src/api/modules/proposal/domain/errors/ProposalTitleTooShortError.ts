import { DomainException } from '@shared/domain/exceptions/DomainExceptions';

export class ProposalTitleTooShortError extends DomainException {
  constructor() {
    super(
      'O título da proposta deve ter pelo menos 3 caracteres.',
      'PROPOSAL_TITLE_TOO_SHORT',
    );
  }
}
