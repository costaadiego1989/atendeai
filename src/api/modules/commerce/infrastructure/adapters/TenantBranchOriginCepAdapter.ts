import { Inject, Injectable } from '@nestjs/common';
import {
  ITenantRepository,
  TENANT_REPOSITORY,
} from '@modules/tenant/domain/repositories/ITenantRepository';
import { IBranchOriginCepPort } from '../../domain/ports/IBranchOriginCepPort';

@Injectable()
export class TenantBranchOriginCepAdapter implements IBranchOriginCepPort {
  constructor(
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepository: ITenantRepository,
  ) {}

  async getOriginCep(
    tenantId: string,
    branchId: string | null,
  ): Promise<string | null> {
    const branches = await this.tenantRepository.listBranches(tenantId);

    if (branchId) {
      const branch = branches.find((b) => b.id.toString() === branchId);
      if (branch?.address?.zipcode) {
        return branch.address.zipcode;
      }
    }

    // Fallback: try headquarters or first branch with a zipcode
    const headquarters = branches.find((b) => b.isHeadquarters);
    if (headquarters?.address?.zipcode) {
      return headquarters.address.zipcode;
    }

    const anyWithCep = branches.find((b) => b.address?.zipcode);
    return anyWithCep?.address?.zipcode ?? null;
  }
}
