import { Inject, Injectable } from '@nestjs/common';
import {
  ITenantRepository,
  TENANT_REPOSITORY,
} from '../../../tenant/domain/repositories/ITenantRepository';
import { Plan } from '../../../tenant/domain/value-objects/Plan';
import { ITenantQueryPort } from '../../application/ports/ITenantQueryPort';

/**
 * Adapter implementing ITenantQueryPort.
 * Encapsulates all tenant module access behind the billing-owned port interface.
 */
@Injectable()
export class TenantQueryAdapter implements ITenantQueryPort {
  constructor(
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepository: ITenantRepository,
  ) {}

  async findTenantById(tenantId: string): Promise<{
    plan: string;
    owner?: {
      name: string;
      email: string;
      phone: string;
    };
    cnpj?: string;
  } | null> {
    const tenant = await this.tenantRepository.findById(tenantId);
    if (!tenant) return null;

    return {
      plan: tenant.plan.value,
      owner: tenant.owner
        ? {
            name: tenant.owner.name,
            email: tenant.owner.email.value,
            phone: tenant.owner.phone.value,
          }
        : undefined,
      cnpj: tenant.cnpj?.value,
    };
  }

  async findTenantPlan(
    tenantId: string,
  ): Promise<{ plan: string; businessType?: string } | null> {
    const tenant = await this.tenantRepository.findById(tenantId);
    if (!tenant) return null;

    return {
      plan: tenant.plan.value,
    };
  }

  async updateTenantPlan(tenantId: string, plan: string): Promise<void> {
    const tenant = await this.tenantRepository.findById(tenantId);
    if (!tenant) return;

    const currentPlan = tenant.plan.value;
    if (currentPlan === plan) return;

    tenant.changePlan(Plan.create(plan));
    await this.tenantRepository.save(tenant);
  }
}
