import { DomainException } from '@shared/domain/exceptions/DomainExceptions';

export class InvalidSessionStateError extends DomainException {
  constructor(sessionId: string, currentStatus: string, action: string) {
    super(`Ação "${action}" inválida para sessão ${sessionId} no status ${currentStatus}.`);
    this.name = 'InvalidSessionStateError';
  }
}
