import { DomainException } from '@shared/domain/exceptions/DomainExceptions';

export class ShoppingSessionNotFoundError extends DomainException {
  constructor(sessionId: string) {
    super(`Sessão de checkout ${sessionId} não encontrada.`);
    this.name = 'ShoppingSessionNotFoundError';
  }
}
