import { Inject, Injectable } from '@nestjs/common';
import { IUseCase } from '@shared/application/IUseCase';
import {
  ITenantRepository,
  TENANT_REPOSITORY,
} from '../../domain/repositories/ITenantRepository';
import {
  EntityNotFoundException,
  ValidationErrorException,
} from '../../../../shared/domain/exceptions/DomainExceptions';
import {
  IRefreshMetaWhatsAppStatusUseCase,
  RefreshMetaWhatsAppStatusInput,
  RefreshMetaWhatsAppStatusOutput,
} from './interfaces/IRefreshMetaWhatsAppStatusUseCase';

@Injectable()
export class RefreshMetaWhatsAppStatusUseCase implements IRefreshMetaWhatsAppStatusUseCase {
  constructor(
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepository: ITenantRepository,
  ) {}

  async execute(
    input: RefreshMetaWhatsAppStatusInput,
  ): Promise<RefreshMetaWhatsAppStatusOutput> {
    const { tenantId, branchId } = input;
    const tenant = await this.tenantRepository.findById(tenantId);
    if (!tenant) {
      throw new EntityNotFoundException('Tenant', tenantId);
    }

    if (branchId) {
      const branches = await this.tenantRepository.listBranches(tenantId);
      const branch = branches.find((b) => b.id.toValue() === branchId);
      if (!branch) {
        throw new EntityNotFoundException('TenantBranch', branchId);
      }
      const override = branch.whatsAppConfigOverride;
      if (!override || override.provider !== 'META_CLOUD') {
        throw new ValidationErrorException(
          'Branch WhatsApp provider is not META_CLOUD',
        );
      }
      const storedAt = override.credentials.configuredAt;
      return {
        id: branch.id.toValue(),
        provider: 'META_CLOUD',
        whatsappNumber:
          branch.whatsappNumber ?? (override.credentials.whatsappNumber || ''),
        status: (override.credentials.status as string) || 'ACTIVE',
        configuredAt: storedAt ? new Date(storedAt) : new Date(0),
      };
    }

    const config = tenant.whatsAppConfig;
    if (!config || config.provider !== 'META_CLOUD') {
      throw new ValidationErrorException('WhatsApp provider is not META_CLOUD');
    }

    return {
      id: tenant.id.toValue(),
      provider: 'META_CLOUD',
      whatsappNumber: config.whatsappNumber,
      status: config.status,
      configuredAt: config.configuredAt,
    };
  }
}
