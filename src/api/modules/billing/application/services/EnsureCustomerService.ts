import { Inject, Injectable } from '@nestjs/common';
import { EntityNotFoundException } from '@shared/domain/exceptions/DomainExceptions';
import {
  ITenantQueryPort,
  BILLING_TENANT_QUERY_PORT,
} from '../ports/ITenantQueryPort';
import { IPaymentPort, BILLING_PAYMENT_PORT } from '../ports/IPaymentPort';
import { Subscription } from '../../domain/entities/Subscription';

/**
 * Domain service responsible for ensuring an Asaas customer exists
 * for a given tenant. Extracts duplicated ensureCustomer logic
 * from ChangeSubscriptionPlanUseCase and PurchaseAddonPackageUseCase.
 */
@Injectable()
export class EnsureCustomerService {
  constructor(
    @Inject(BILLING_TENANT_QUERY_PORT)
    private readonly tenantQueryPort: ITenantQueryPort,
    @Inject(BILLING_PAYMENT_PORT)
    private readonly paymentPort: IPaymentPort,
  ) {}

  /**
   * Ensures the subscription has an associated Asaas customer.
   * If the subscription already has a customerId, returns it.
   * Otherwise, looks up tenant data and creates a new customer.
   *
   * Mutates the subscription by calling updateAsaasCustomer().
   */
  async ensure(tenantId: string, subscription: Subscription): Promise<string> {
    if (subscription.asaasCustomerId) {
      return subscription.asaasCustomerId;
    }

    const tenant = await this.tenantQueryPort.findTenantById(tenantId);

    if (!tenant || !tenant.owner) {
      throw new EntityNotFoundException('Tenant', tenantId);
    }

    const customer = await this.paymentPort.createCustomer({
      name: tenant.owner.name,
      email: tenant.owner.email,
      cpfCnpj: tenant.cnpj ?? '',
      phone: tenant.owner.phone,
      externalReference: tenantId,
    });

    subscription.updateAsaasCustomer(customer.customerId);
    return customer.customerId;
  }
}
