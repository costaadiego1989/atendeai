import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { IUseCase } from '@shared/application/IUseCase';
import {
  ITenantRepository,
  TENANT_REPOSITORY,
} from '../../domain/repositories/ITenantRepository';
import { Promotion } from '../../domain/value-objects/Promotion';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '../../domain/repositories/IUserRepository';
import { TenantAuditService } from '../services/TenantAuditService';

export interface UpdatePromotionInput {
  tenantId: string;
  requestingUserId?: string;
  requestingUserEmail?: string;
  promotionId: string;
  title: string;
  description: string;
  value: string;
  imageUrl?: string;
  expiresAt?: string;
  assignedUserId?: string;
}

@Injectable()
export class UpdatePromotionUseCase implements IUseCase<
  UpdatePromotionInput,
  void
> {
  constructor(
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepository: ITenantRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly tenantAuditService: TenantAuditService,
  ) {}

  async execute(input: UpdatePromotionInput): Promise<void> {
    const tenant = await this.tenantRepository.findById(input.tenantId);
    if (!tenant) {
      throw new NotFoundException(`Tenant ${input.tenantId} not found`);
    }

    const currentPromotion = tenant.promotions.find(
      (promotion) => promotion.id === input.promotionId,
    );

    if (!currentPromotion) {
      throw new NotFoundException(
        `Promotion ${input.promotionId} not found for tenant ${input.tenantId}`,
      );
    }

    const assignedUserId = input.assignedUserId?.trim() || undefined;
    const expiresAt = input.expiresAt?.trim() || undefined;
    const imageUrl = input.imageUrl?.trim() || undefined;

    let assignedUserName: string | undefined;
    if (assignedUserId) {
      const assignedUser = await this.userRepository.findByIdAndTenant(
        assignedUserId,
        input.tenantId,
      );
      if (!assignedUser) {
        throw new NotFoundException(
          `User ${assignedUserId} not found for tenant ${input.tenantId}`,
        );
      }
      assignedUserName = assignedUser.name;
    }

    const updatedPromotion = Promotion.create({
      id: currentPromotion.id,
      title: input.title,
      description: input.description,
      value: input.value,
      imageUrl,
      expiresAt,
      assignedUserId,
      assignedUserName,
    });

    tenant.updateBusinessData({
      cnpj: tenant.cnpj.value,
      promotions: tenant.promotions.map((promotion) =>
        promotion.id === input.promotionId ? updatedPromotion : promotion,
      ),
    });

    await this.tenantRepository.save(tenant);
    await this.tenantAuditService.record({
      tenantId: input.tenantId,
      userId: input.requestingUserId,
      email: input.requestingUserEmail,
      eventType: 'PROMOTION_UPDATED',
      metadata: {
        promotionId: updatedPromotion.id,
        title: updatedPromotion.title,
        assignedUserId: updatedPromotion.assignedUserId ?? null,
        expiresAt: updatedPromotion.expiresAt ?? null,
      },
    });
  }
}
