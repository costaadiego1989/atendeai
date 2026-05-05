import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  ITenantRepository,
  TENANT_REPOSITORY,
} from '../../domain/repositories/ITenantRepository';
import {
  GetTenantProfileSectionsOutput,
  IGetTenantProfileSectionsUseCase,
} from './interfaces/IGetTenantProfileSectionsUseCase';

@Injectable()
export class GetTenantProfileSectionsUseCase implements IGetTenantProfileSectionsUseCase {
  constructor(
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepository: ITenantRepository,
  ) {}

  async execute(tenantId: string): Promise<GetTenantProfileSectionsOutput> {
    const tenant = await this.tenantRepository.findById(tenantId);

    if (!tenant) {
      throw new NotFoundException(`Tenant with ID ${tenantId} not found`);
    }

    return {
      id: tenant.id.toValue(),
      marketing: {
        companyName: tenant.companyName.value,
        businessType: tenant.businessType,
        description: tenant.description,
        services: tenant.services,
        catalogUrl: tenant.catalogUrl,
        catalogFiles: tenant.catalogFiles,
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
      },
      technical: {
        cnpj: tenant.cnpj.value,
        plan: tenant.plan.value,
        planStatus: tenant.planStatus,
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
            instagramAccountId: tenant.instagramConfig?.instagramAccountId ?? null,
          },
        },
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
      },
    };
  }
}
