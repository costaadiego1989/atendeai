import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InstagramConfig } from '../../domain/entities/InstagramConfig';
import {
  ITenantRepository,
  TENANT_REPOSITORY,
} from '../../domain/repositories/ITenantRepository';
import { EntityNotFoundException } from '../../../../shared/domain/exceptions/DomainExceptions';
import { ValidationErrorException } from '../../../../shared/domain/exceptions/DomainExceptions';
import {
  ConfigureInstagramInput,
  ConfigureInstagramOutput,
  IConfigureInstagramUseCase,
} from './interfaces/IConfigureInstagramUseCase';
import { TenantDomainEventPublisher } from '../services/TenantDomainEventPublisher';
import { TenantAuditService } from '../services/TenantAuditService';

@Injectable()
export class ConfigureInstagramUseCase implements IConfigureInstagramUseCase {
  constructor(
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepo: ITenantRepository,
    private readonly tenantDomainEventPublisher: TenantDomainEventPublisher,
    private readonly configService: ConfigService,
    private readonly tenantAuditService: TenantAuditService,
  ) {}

  async execute(
    input: ConfigureInstagramInput,
  ): Promise<ConfigureInstagramOutput> {
    const tenant = await this.tenantRepo.findById(input.tenantId);
    if (!tenant) {
      throw new EntityNotFoundException('Tenant', input.tenantId);
    }

    const platformMetaAccessToken =
      this.configService.get<string>('META_ACCESS_TOKEN') || '';
    const platformWebhookSecret =
      this.configService.get<string>('META_WEBHOOK_SECRET') || '';

    if (!platformMetaAccessToken || !platformWebhookSecret) {
      throw new ValidationErrorException(
        'Platform Instagram credentials are not configured',
      );
    }

    if (input.branchId) {
      const branches = await this.tenantRepo.listBranches(input.tenantId);
      const branch = branches.find(
        (item) => item.id.toValue() === input.branchId,
      );
      if (!branch) {
        throw new EntityNotFoundException('TenantBranch', input.branchId);
      }

      await this.tenantRepo.updateBranch(branch.id.toValue(), {
        tenantId: input.tenantId,
        name: branch.name,
        cnpj: branch.cnpj,
        phone: branch.phone,
        email: branch.email,
        whatsappNumber: branch.whatsappNumber,
        instagramAccountId: input.instagramAccountId,
        whatsAppConfigOverride: branch.whatsAppConfigOverride,
        zipcode: branch.address?.zipcode ?? null,
        street: branch.address?.street ?? null,
        streetNumber: branch.address?.streetNumber ?? null,
        neighborhood: branch.address?.neighborhood ?? null,
        city: branch.address?.city ?? null,
        state: branch.address?.state ?? null,
        operatingHours: branch.operatingHours,
        isHeadquarters: branch.isHeadquarters,
        active: branch.active,
      });

      await this.tenantAuditService.record({
        tenantId: input.tenantId,
        userId: input.requestingUserId,
        email: input.requestingUserEmail,
        eventType: 'INSTAGRAM_CONFIGURED',
        metadata: {
          branchId: branch.id.toValue(),
          branchName: branch.name,
          instagramAccountId: input.instagramAccountId,
          status: 'ACTIVE',
        },
      });

      return {
        id: branch.id.toValue(),
        instagramAccountId: input.instagramAccountId,
        status: 'ACTIVE',
        configuredAt: new Date(),
      };
    }

    const config = InstagramConfig.create({
      metaAccessToken: platformMetaAccessToken,
      instagramAccountId: input.instagramAccountId,
      webhookSecret: platformWebhookSecret,
    });

    tenant.configureInstagram(config);
    await this.tenantRepo.save(tenant);
    await this.tenantAuditService.record({
      tenantId: input.tenantId,
      userId: input.requestingUserId,
      email: input.requestingUserEmail,
      eventType: 'INSTAGRAM_CONFIGURED',
      metadata: {
        instagramAccountId: config.instagramAccountId,
        status: config.status,
      },
    });
    await this.tenantDomainEventPublisher.publishFromAggregate(tenant);

    return {
      id: config.id.toValue(),
      instagramAccountId: config.instagramAccountId,
      status: config.status,
      configuredAt: config.configuredAt,
    };
  }
}
