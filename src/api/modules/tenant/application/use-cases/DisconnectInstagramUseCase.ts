import { Inject, Injectable } from '@nestjs/common';
import {
  ITenantRepository,
  TENANT_REPOSITORY,
} from '../../domain/repositories/ITenantRepository';
import { EntityNotFoundException } from '../../../../shared/domain/exceptions/DomainExceptions';
import { TenantDomainEventPublisher } from '../services/TenantDomainEventPublisher';
import { TenantAuditService } from '../services/TenantAuditService';

export interface DisconnectInstagramInput {
  tenantId: string;
  branchId?: string;
  requestingUserId: string;
  requestingUserEmail: string;
}

@Injectable()
export class DisconnectInstagramUseCase {
  constructor(
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepo: ITenantRepository,
    private readonly tenantDomainEventPublisher: TenantDomainEventPublisher,
    private readonly tenantAuditService: TenantAuditService,
  ) {}

  async execute(input: DisconnectInstagramInput): Promise<{ success: boolean }> {
    const tenant = await this.tenantRepo.findById(input.tenantId);
    if (!tenant) {
      throw new EntityNotFoundException('Tenant', input.tenantId);
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
        instagramAccountId: null,
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
        eventType: 'INSTAGRAM_DISCONNECTED',
        metadata: {
          branchId: branch.id.toValue(),
          branchName: branch.name,
        },
      });

      return { success: true };
    }

    tenant.disconnectInstagram();
    await this.tenantRepo.save(tenant);
    await this.tenantAuditService.record({
      tenantId: input.tenantId,
      userId: input.requestingUserId,
      email: input.requestingUserEmail,
      eventType: 'INSTAGRAM_DISCONNECTED',
      metadata: {},
    });
    await this.tenantDomainEventPublisher.publishFromAggregate(tenant);

    return { success: true };
  }
}
