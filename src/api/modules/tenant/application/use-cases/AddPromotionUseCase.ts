import { Injectable, Inject, NotFoundException } from '@nestjs/common';
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

export interface AddPromotionInput {
  tenantId: string;
  requestingUserId?: string;
  requestingUserEmail?: string;
  title: string;
  description: string;
  value: string;
  imageUrl?: string;
  expiresAt?: string;
  assignedUserId?: string;
}

@Injectable()
export class AddPromotionUseCase {
  constructor(
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepository: ITenantRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly tenantAuditService: TenantAuditService,
  ) {}

  async execute(input: AddPromotionInput): Promise<void> {
    const tenant = await this.tenantRepository.findById(input.tenantId);
    if (!tenant) {
      throw new NotFoundException(`Tenant ${input.tenantId} not found`);
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

    const promotion = Promotion.create({
      title: input.title,
      description: input.description,
      value: input.value,
      imageUrl,
      expiresAt,
      assignedUserId,
      assignedUserName,
    });

    tenant.updateBusinessData({
      promotions: [...tenant.promotions, promotion],
    });

    await this.tenantRepository.save(tenant);
    await this.tenantAuditService.record({
      tenantId: input.tenantId,
      userId: input.requestingUserId,
      email: input.requestingUserEmail,
      eventType: 'PROMOTION_ADDED',
      metadata: {
        promotionId: promotion.id,
        title: promotion.title,
        assignedUserId: promotion.assignedUserId ?? null,
        expiresAt: promotion.expiresAt ?? null,
      },
    });
  }
}
