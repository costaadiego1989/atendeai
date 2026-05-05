import { Inject, Injectable } from '@nestjs/common';
import {
  ITenantRepository,
  TENANT_REPOSITORY,
} from '../../domain/repositories/ITenantRepository.js';
import { TenantAuditService } from '../services/TenantAuditService.js';

interface DeleteTenantBranchInput {
  tenantId: string;
  branchId: string;
  requestingUserId?: string;
  requestingUserEmail?: string;
}

@Injectable()
export class DeleteTenantBranchUseCase {
  constructor(
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepository: ITenantRepository,
    private readonly tenantAuditService: TenantAuditService,
  ) { }

  async execute(input: DeleteTenantBranchInput) {
    await this.tenantRepository.deleteBranch(input.tenantId, input.branchId);

    await this.tenantAuditService.record({
      tenantId: input.tenantId,
      eventType: 'BRANCH_DELETED',
      userId: input.requestingUserId,
      email: input.requestingUserEmail,
      metadata: {
        branchId: input.branchId,
      },
    });

    return {
      success: true,
    };
  }
}
