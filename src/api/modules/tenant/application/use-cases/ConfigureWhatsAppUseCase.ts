import { Inject, Injectable } from '@nestjs/common';
import {
  ITenantRepository,
  TENANT_REPOSITORY,
} from '../../domain/repositories/ITenantRepository';
import { EntityNotFoundException } from '../../../../shared/domain/exceptions/DomainExceptions';
import {
  IConfigureWhatsAppUseCase,
  ConfigureWhatsAppInput,
  ConfigureWhatsAppOutput,
} from './interfaces/IConfigureWhatsAppUseCase';
import { TenantDomainEventPublisher } from '../services/TenantDomainEventPublisher';
import { WhatsAppConfigurationStrategyRegistry } from '../strategies/whatsapp/WhatsAppConfigurationStrategyRegistry';
import { TenantAuditService } from '../services/TenantAuditService';
import { TenantBillingCapacityService } from '@shared/infrastructure/billing/TenantBillingCapacityService';

@Injectable()
export class ConfigureWhatsAppUseCase implements IConfigureWhatsAppUseCase {
  constructor(
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepo: ITenantRepository,
    private readonly tenantDomainEventPublisher: TenantDomainEventPublisher,
    private readonly whatsAppConfigurationStrategyRegistry: WhatsAppConfigurationStrategyRegistry,
    private readonly tenantAuditService: TenantAuditService,
    private readonly billingCapacityService: TenantBillingCapacityService,
  ) {}

  async execute(
    input: ConfigureWhatsAppInput,
  ): Promise<ConfigureWhatsAppOutput> {
    const tenant = await this.tenantRepo.findById(input.tenantId);
    if (!tenant) {
      throw new EntityNotFoundException('Tenant', input.tenantId);
    }

    const currentWhatsappNumber = tenant.whatsAppConfig?.whatsappNumber ?? '';
    const isAddingWhatsapp =
      !!input.whatsappNumber?.trim() &&
      input.whatsappNumber.replace(/\D/g, '') !==
        currentWhatsappNumber.replace(/\D/g, '');

    if (isAddingWhatsapp) {
      await this.billingCapacityService.assertCanAdd(
        input.tenantId,
        'whatsappNumbers',
      );
    }

    const provider = input.provider ?? 'BUBBLEWHATS';
    const strategy =
      this.whatsAppConfigurationStrategyRegistry.resolve(provider);
    const config = await strategy.configure(input);

    tenant.configureWhatsApp(config);
    await this.tenantRepo.save(tenant);
    await this.tenantAuditService.record({
      tenantId: input.tenantId,
      userId: input.requestingUserId,
      email: input.requestingUserEmail,
      eventType: 'WHATSAPP_CONFIGURED',
      metadata: {
        provider: config.provider,
        whatsappNumber: config.whatsappNumber,
        status: config.status,
      },
    });
    await this.tenantDomainEventPublisher.publishFromAggregate(tenant);

    return {
      id: config.id.toValue(),
      provider: config.provider,
      whatsappNumber: config.whatsappNumber,
      status: config.status,
      configuredAt: config.configuredAt,
    };
  }
}
