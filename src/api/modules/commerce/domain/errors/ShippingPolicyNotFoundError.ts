import { DomainException } from '@shared/domain/exceptions/DomainExceptions';

export class ShippingPolicyNotFoundError extends DomainException {
  constructor(tenantId: string) {
    super(`Política de frete não encontrada para o locatário ${tenantId}.`);
    this.name = 'ShippingPolicyNotFoundError';
  }
}
