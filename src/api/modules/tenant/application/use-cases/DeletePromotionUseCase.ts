import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  ITenantRepository,
  TENANT_REPOSITORY,
} from '../../domain/repositories/ITenantRepository';
import { TenantAuditService } from '../services/TenantAuditService';

export interface DeletePromotionInput {
  tenantId: string;
  requestingUserId?: string;
  requestingUserEmail?: string;
  promotionId: string;
}

@Injectable()
export class DeletePromotionUseCase {
  constructor(
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepository: ITenantRepository,
    private readonly tenantAuditService: TenantAuditService,
  ) {}

  async execute(input: DeletePromotionInput): Promise<void> {
    const tenant = await this.tenantRepository.findById(input.tenantId);
    if (!tenant) {
      throw new NotFoundException(`Tenant ${input.tenantId} not found`);
    }

    const hasPromotion = tenant.promotions.some(
      (promotion) => promotion.id === input.promotionId,
    );

    if (!hasPromotion) {
      throw new NotFoundException(
        `Promotion ${input.promotionId} not found for tenant ${input.tenantId}`,
      );
    }

    tenant.updateBusinessData({
      cnpj: tenant.cnpj.value,
      promotions: tenant.promotions.filter(
        (promotion) => promotion.id !== input.promotionId,
      ),
    });

    await this.tenantRepository.save(tenant);
    await this.tenantAuditService.record({
      tenantId: input.tenantId,
      userId: input.requestingUserId,
      email: input.requestingUserEmail,
      eventType: 'PROMOTION_DELETED',
      metadata: {
        promotionId: input.promotionId,
      },
    });
  }
}
