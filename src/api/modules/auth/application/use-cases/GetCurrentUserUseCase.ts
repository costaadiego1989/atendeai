import { Inject, Injectable } from '@nestjs/common';
import {
  IAuthUserRepository,
  AUTH_USER_REPOSITORY,
} from '../../domain/repositories/IAuthUserRepository';
import { EntityNotFoundException } from '@shared/domain/exceptions/DomainExceptions';
import {
  IGetCurrentUserUseCase,
  GetCurrentUserOutput,
} from './interfaces/IGetCurrentUserUseCase';
import { TenantModuleAccessService } from '@shared/infrastructure/billing/TenantModuleAccessService';

@Injectable()
export class GetCurrentUserUseCase implements IGetCurrentUserUseCase {
  constructor(
    @Inject(AUTH_USER_REPOSITORY)
    private readonly authUserRepo: IAuthUserRepository,
    private readonly tenantModuleAccessService: TenantModuleAccessService,
  ) {}

  async execute(userId: string): Promise<GetCurrentUserOutput> {
    const user = await this.authUserRepo.findById(userId);
    if (!user) {
      throw new EntityNotFoundException('User', userId);
    }

    const billingAccess = await this.tenantModuleAccessService.getSummary(
      user.tenantId,
    );

    return {
      user: {
        id: user.id.toString(),
        tenantId: user.tenantId,
        name: user.name,
        email: user.email.value,
        accessibleBranchIds: user.tenantBranches
          .filter((branch) => branch.active)
          .map((branch) => branch.id),
        phone: user.phone,
        cpf: user.cpf,
        role: user.role.value,
        mustChangePassword: user.mustChangePassword,
      },
      tenant: {
        id: user.tenantId,
        name: user.tenantName ?? 'Empresa',
        plan: billingAccess.plan,
        cnpj: user.tenantCnpj,
        businessType: user.tenantBusinessType,
        planStatus: user.planStatus,
        billingAccess,
        branches: user.tenantBranches,
        createdAt: user.tenantCreatedAt.toISOString(),
      },
    };
  }
}
