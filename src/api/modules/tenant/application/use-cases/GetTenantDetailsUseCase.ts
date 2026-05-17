import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  ITenantRepository,
  TENANT_REPOSITORY,
} from '../../domain/repositories/ITenantRepository';
import {
  IGetTenantDetailsUseCase,
  GetTenantDetailsOutput,
} from './interfaces/IGetTenantDetailsUseCase';
import { TenantModuleAccessService } from '@shared/infrastructure/billing/TenantModuleAccessService';

@Injectable()
export class GetTenantDetailsUseCase implements IGetTenantDetailsUseCase {
  constructor(
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepository: ITenantRepository,
    private readonly tenantModuleAccessService: TenantModuleAccessService,
  ) {}

  async execute(tenantId: string): Promise<GetTenantDetailsOutput> {
    const tenant = await this.tenantRepository.findById(tenantId);

    if (!tenant) {
      throw new NotFoundException(`Tenant with ID ${tenantId} not found`);
    }

    const ownerUser = tenant.owner;
    const billingAccess =
      await this.tenantModuleAccessService.getSummary(tenantId);

    return {
      id: tenant.id.toValue(),
      companyName: tenant.companyName.value,
      cnpj: tenant.cnpj.value,
      plan: tenant.plan.value,
      billingAccess,
      businessType: tenant.businessType,
      description: tenant.description,
      services: tenant.services,
      catalogUrl: tenant.catalogUrl,
      aiConfig: tenant.aiConfig
        ? {
            systemPrompt: tenant.aiConfig.systemPrompt,
            tone: tenant.aiConfig.tone,
            language: tenant.aiConfig.language,
            maxTokensPerResponse: tenant.aiConfig.maxTokensPerResponse,
            confidenceThreshold: tenant.aiConfig.confidenceThreshold,
            escalationMessage: tenant.aiConfig.escalationMessage,
            businessRules: tenant.aiConfig.businessRules,
            updatedAt: tenant.aiConfig.updatedAt,
          }
        : null,
      createdAt: tenant.createdAt,
      address: tenant.address?.toValue() ?? null,
      operatingHours: (tenant.operatingHours as any) ?? null,
      promotions: tenant.promotions.map((promotion) => ({
        id: promotion.id,
        title: promotion.title,
        description: promotion.description,
        value: promotion.value,
        imageUrl: promotion.imageUrl,
        expiresAt: promotion.expiresAt,
        assignedUserId: promotion.assignedUserId,
        assignedUserName: promotion.assignedUserName,
      })),
      owner: ownerUser
        ? {
            name: ownerUser.name,
            email: ownerUser.email.value,
            phone: ownerUser.phone.value,
            cpf: ownerUser.cpf?.value ?? null,
            birthDate: tenant.ownerBirthDate ?? null,
          }
        : null,
    };
  }
}
