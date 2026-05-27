import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  ITenantRepository,
  TENANT_REPOSITORY,
} from '../../domain/repositories/ITenantRepository';
import {
  ITenantAuditLogRepository,
  TENANT_AUDIT_LOG_REPOSITORY,
} from '../../domain/repositories/ITenantAuditLogRepository';
import {
  GetTenantSettingsOutput,
  IGetTenantSettingsUseCase,
} from './interfaces/IGetTenantSettingsUseCase';
import { TenantModuleAccessService } from '@shared/infrastructure/billing/TenantModuleAccessService';

@Injectable()
export class GetTenantSettingsUseCase implements IGetTenantSettingsUseCase {
  constructor(
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepository: ITenantRepository,
    @Inject(TENANT_AUDIT_LOG_REPOSITORY)
    private readonly tenantAuditLogRepository: ITenantAuditLogRepository,
    private readonly tenantModuleAccessService: TenantModuleAccessService,
  ) {}

  async execute(tenantId: string): Promise<GetTenantSettingsOutput> {
    const [tenant, recentAuditLogs, branches, billingAccess] =
      await Promise.all([
        this.tenantRepository.findById(tenantId),
        this.tenantAuditLogRepository.listRecent(tenantId, 8),
        this.tenantRepository.listBranches(tenantId),
        this.tenantModuleAccessService.getSummary(tenantId),
      ]);

    if (!tenant) {
      throw new NotFoundException(`Tenant with ID ${tenantId} not found`);
    }

    const ownerUser = tenant.owner;

    return {
      id: tenant.id.toValue(),
      support: {
        tenantId: tenant.id.toValue(),
        plan: tenant.plan.value,
        planStatus: tenant.planStatus,
        createdAt: tenant.createdAt,
      },
      billingAccess,
      recentAuditLogs: recentAuditLogs.map((entry) => ({
        id: entry.id,
        eventType: entry.eventType,
        email: entry.email ?? null,
        createdAt: entry.createdAt,
        metadata: entry.metadata,
      })),
      channels: {
        whatsapp: {
          configured: tenant.whatsAppConfig !== null,
          connected: tenant.whatsAppConfig?.status === 'ACTIVE',
          provider: tenant.whatsAppConfig?.provider ?? null,
          status: tenant.whatsAppConfig?.status ?? null,
          whatsappNumber: tenant.whatsAppConfig?.whatsappNumber ?? null,
        },
        instagram: {
          configured: tenant.instagramConfig !== null,
          connected: tenant.instagramConfig?.status === 'ACTIVE',
          status: tenant.instagramConfig?.status ?? null,
          instagramAccountId:
            tenant.instagramConfig?.instagramAccountId ?? null,
        },
      },
      company: {
        companyName: tenant.companyName.value,
        cnpj: tenant.cnpj.value,
        businessType: tenant.businessType,
        description: tenant.description,
        services: tenant.services,
        catalogUrl: tenant.catalogUrl,
        catalogFiles: tenant.catalogFiles,
      },
      owner: ownerUser
        ? {
            id: ownerUser.id.toValue(),
            name: ownerUser.name,
            email: ownerUser.email.value,
            phone: ownerUser.phone.value,
            cpf: ownerUser.cpf?.value ?? null,
            birthDate: tenant.ownerBirthDate ?? null,
          }
        : null,
      address: tenant.address?.toValue() ?? null,
      branches: branches.map((branch) => ({
        id: branch.id.toValue(),
        name: branch.name,
        phone: branch.phone,
        email: branch.email,
        whatsappNumber: branch.whatsappNumber,
        instagramAccountId: branch.instagramAccountId,
        whatsAppConfigOverride: branch.whatsAppConfigOverride,
        ...(branch.address?.toValue() ?? {}),
        operatingHours: branch.operatingHours,
        isHeadquarters: branch.isHeadquarters,
        active: branch.active,
        createdAt: branch.createdAt,
        updatedAt: branch.updatedAt,
      })),
      operatingHours: (tenant.operatingHours as any) ?? null,
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
    };
  }
}
