import { DomainException } from '@shared/domain/exceptions/DomainExceptions';

export class ProposalInvalidScheduleDateError extends DomainException {
  constructor() {
    super('A data de agendamento da proposta deve ser no futuro.', 'PROPOSAL_INVALID_SCHEDULE_DATE');
  }
}
