import { Inject, Injectable } from '@nestjs/common';
import { IUseCase } from '@shared/application/IUseCase';
import { EntityNotFoundException } from '@shared/domain/exceptions/DomainExceptions';
import {
  ITenantRepository,
  TENANT_REPOSITORY,
} from '../../domain/repositories/ITenantRepository';
import { MetaInstagramOAuthService } from '../../infrastructure/services/MetaInstagramOAuthService';
import { MetaInstagramOAuthStateService } from '../../infrastructure/services/MetaInstagramOAuthStateService';

interface Input {
  tenantId: string;
  branchId?: string | null;
}

@Injectable()
export class StartMetaInstagramConnectionUseCase implements IUseCase<
  Input,
  { authorizationUrl: string }
> {
  constructor(
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepository: ITenantRepository,
    private readonly oauthService: MetaInstagramOAuthService,
    private readonly stateService: MetaInstagramOAuthStateService,
  ) {}

  async execute(input: Input): Promise<{ authorizationUrl: string }> {
    const tenant = await this.tenantRepository.findById(input.tenantId);
    if (!tenant) {
      throw new EntityNotFoundException('Tenant', input.tenantId);
    }

    if (input.branchId) {
      const branch = (
        await this.tenantRepository.listBranches(input.tenantId)
      ).find((item) => item.id.toValue() === input.branchId);
      if (!branch) {
        throw new EntityNotFoundException('TenantBranch', input.branchId);
      }
    }

    return {
      authorizationUrl: this.oauthService.buildAuthorizationUrl(
        this.stateService.sign(input.tenantId, input.branchId),
      ),
    };
  }
}
