import { DomainException } from '@shared/domain/exceptions/DomainExceptions';

export class OrderNotFoundError extends DomainException {
  constructor(orderId: string) {
    super(`Pedido ${orderId} não encontrado.`);
    this.name = 'OrderNotFoundError';
  }
}
