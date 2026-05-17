import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  ITenantRepository,
  TENANT_REPOSITORY,
} from '../../domain/repositories/ITenantRepository';
import { TenantPDFResumeRepository } from '../../infrastructure/persistence/repositories/TenantPDFResumeRepository';
import {
  GetTenantOnboardingChecklistOutput,
  IGetTenantOnboardingChecklistUseCase,
  TenantOnboardingChecklistItem,
} from './interfaces/IGetTenantOnboardingChecklistUseCase';

@Injectable()
export class GetTenantOnboardingChecklistUseCase implements IGetTenantOnboardingChecklistUseCase {
  constructor(
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepository: ITenantRepository,
    private readonly tenantPDFResumeRepository: TenantPDFResumeRepository,
  ) {}

  async execute(tenantId: string): Promise<GetTenantOnboardingChecklistOutput> {
    const [tenant, pdfResumes] = await Promise.all([
      this.tenantRepository.findById(tenantId),
      this.tenantPDFResumeRepository.listByTenant(tenantId),
    ]);

    if (!tenant) {
      throw new NotFoundException(`Tenant with ID ${tenantId} not found`);
    }

    const hasBusinessStory =
      !!tenant.description?.trim() || !!tenant.services?.trim();
    const hasCatalogSurface =
      !!tenant.catalogUrl?.trim() ||
      tenant.catalogFiles.length > 0 ||
      pdfResumes.some((r) => r.status === 'READY');

    const items: TenantOnboardingChecklistItem[] = [
      {
        key: 'business_profile',
        label: 'Perfil comercial (tipo + descrição ou serviços)',
        completed: !!tenant.businessType?.trim() && hasBusinessStory,
      },
      {
        key: 'catalog_or_documents',
        label: 'Catálogo, arquivos ou PDF processado para a IA',
        completed: hasCatalogSurface,
      },
      {
        key: 'whatsapp_connected',
        label: 'WhatsApp ativo',
        completed: tenant.whatsAppConfig?.status === 'ACTIVE',
      },
      {
        key: 'instagram_connected',
        label: 'Instagram ativo',
        completed: tenant.instagramConfig?.status === 'ACTIVE',
      },
      {
        key: 'ai_configured',
        label: 'Assistente IA configurado',
        completed: tenant.aiConfig !== null,
      },
    ];

    const completedCount = items.filter((i) => i.completed).length;
    const completionRatio =
      items.length === 0
        ? 1
        : Math.round((completedCount / items.length) * 1000) / 1000;

    return {
      id: tenant.id.toValue(),
      completionRatio,
      items,
    };
  }
}
