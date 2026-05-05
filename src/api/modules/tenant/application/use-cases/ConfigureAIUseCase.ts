import { Inject, Injectable } from '@nestjs/common';
import {
  ITenantRepository,
  TENANT_REPOSITORY,
} from '../../domain/repositories/ITenantRepository';
import { AIConfig, ToneType } from '../../domain/entities/AIConfig';
import { EntityNotFoundException } from '../../../../shared/domain/exceptions/DomainExceptions';
import {
  IConfigureAIUseCase,
  ConfigureAIInput,
  ConfigureAIOutput,
} from './interfaces/IConfigureAIUseCase';
import { TenantDomainEventPublisher } from '../services/TenantDomainEventPublisher';
import { TenantAuditService } from '../services/TenantAuditService';

@Injectable()
export class ConfigureAIUseCase implements IConfigureAIUseCase {
  constructor(
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepo: ITenantRepository,
    private readonly tenantDomainEventPublisher: TenantDomainEventPublisher,
    private readonly tenantAuditService: TenantAuditService,
  ) {}

  async execute(input: ConfigureAIInput): Promise<ConfigureAIOutput> {
    const tenant = await this.tenantRepo.findById(input.tenantId);
    if (!tenant) {
      throw new EntityNotFoundException('Tenant', input.tenantId);
    }

    const config = AIConfig.create({
      systemPrompt: input.systemPrompt,
      tone: input.tone as ToneType,
      language: input.language ?? 'pt-BR',
      maxTokensPerResponse: input.maxTokensPerResponse ?? 500,
      confidenceThreshold: input.confidenceThreshold ?? 0.7,
      escalationMessage: input.escalationMessage || null,
      businessRules: input.businessRules ?? [],
    });

    tenant.configureAI(config);
    await this.tenantRepo.save(tenant);
    await this.tenantAuditService.record({
      tenantId: input.tenantId,
      userId: input.requestingUserId,
      email: input.requestingUserEmail,
      eventType: 'AI_CONFIG_UPDATED',
      metadata: {
        tone: config.tone,
        language: config.language,
        businessRulesCount: config.businessRules.length,
        maxTokensPerResponse: config.maxTokensPerResponse,
      },
    });
    await this.tenantDomainEventPublisher.publishFromAggregate(tenant);

    return {
      id: config.id.toValue(),
      systemPrompt: config.systemPrompt,
      tone: config.tone,
      updatedAt: config.updatedAt,
    };
  }
}
