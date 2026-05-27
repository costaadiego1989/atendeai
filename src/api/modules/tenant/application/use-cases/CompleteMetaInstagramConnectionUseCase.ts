import { Inject, Injectable } from '@nestjs/common';
import { IUseCase } from '@shared/application/IUseCase';
import { EntityNotFoundException } from '@shared/domain/exceptions/DomainExceptions';
import {
  ITenantRepository,
  TENANT_REPOSITORY,
} from '../../domain/repositories/ITenantRepository';
import {
  MetaInstagramOAuthService,
  MetaInstagramSelectableAccount,
} from '../../infrastructure/services/MetaInstagramOAuthService';
import { MetaInstagramOAuthStateService } from '../../infrastructure/services/MetaInstagramOAuthStateService';

interface Input {
  code: string;
  state: string;
}

@Injectable()
export class CompleteMetaInstagramConnectionUseCase implements IUseCase<
  Input,
  {
    tenantId: string;
    branchId: string | null;
    accounts: MetaInstagramSelectableAccount[];
  }
> {
  constructor(
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepository: ITenantRepository,
    private readonly oauthService: MetaInstagramOAuthService,
    private readonly stateService: MetaInstagramOAuthStateService,
  ) {}

  async execute(input: Input): Promise<{
    tenantId: string;
    branchId: string | null;
    accounts: MetaInstagramSelectableAccount[];
  }> {
    const payload = this.stateService.verify(input.state);
    const tenant = await this.tenantRepository.findById(payload.tenantId);
    if (!tenant) {
      throw new EntityNotFoundException('Tenant', payload.tenantId);
    }

    if (payload.branchId) {
      const branch = (
        await this.tenantRepository.listBranches(payload.tenantId)
      ).find((item) => item.id.toValue() === payload.branchId);
      if (!branch) {
        throw new EntityNotFoundException('TenantBranch', payload.branchId);
      }
    }

    const accessToken = await this.oauthService.exchangeCodeForAccessToken(
      input.code,
      payload.tenantId,
    );
    const accounts = await this.oauthService.listInstagramAccounts(
      accessToken,
      payload.tenantId,
    );

    return {
      tenantId: payload.tenantId,
      branchId: payload.branchId ?? null,
      accounts,
    };
  }
}
