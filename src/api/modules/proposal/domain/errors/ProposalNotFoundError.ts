import { DomainException } from '@shared/domain/exceptions/DomainExceptions';

export class ProposalNotFoundError extends DomainException {
  constructor(id: string) {
    super(`Proposta com ID ${id} não encontrada.`, 'PROPOSAL_NOT_FOUND');
  }
}
