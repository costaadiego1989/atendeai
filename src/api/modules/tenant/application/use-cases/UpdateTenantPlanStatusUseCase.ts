import { Inject, Injectable } from '@nestjs/common';
import {
  ITenantRepository,
  TENANT_REPOSITORY,
} from '../../domain/repositories/ITenantRepository';
import { EntityNotFoundException } from '@shared/domain/exceptions/DomainExceptions';

export interface UpdateTenantPlanStatusInput {
  tenantId: string;
  status: string;
}

@Injectable()
export class UpdateTenantPlanStatusUseCase {
  constructor(
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepo: ITenantRepository,
  ) {}

  async execute(input: UpdateTenantPlanStatusInput): Promise<void> {
    const tenant = await this.tenantRepo.findById(input.tenantId);

    if (!tenant) {
      throw new EntityNotFoundException('Tenant', input.tenantId);
    }

    tenant.updatePlanStatus(input.status);

    await this.tenantRepo.save(tenant);
  }
}
