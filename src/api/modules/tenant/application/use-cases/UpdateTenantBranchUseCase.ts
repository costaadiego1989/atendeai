import { Inject, Injectable } from '@nestjs/common';
import {
  ITenantRepository,
  TENANT_REPOSITORY,
} from '../../domain/repositories/ITenantRepository.js';
import { OperatingHours } from '../../domain/entities/Tenant.js';
import { TenantAuditService } from '../services/TenantAuditService.js';
import { TenantBillingCapacityService } from '@shared/infrastructure/billing/TenantBillingCapacityService';

interface UpdateTenantBranchInput {
  tenantId: string;
  branchId: string;
  name: string;
  cnpj?: string | null;
  phone?: string | null;
  email?: string | null;
  whatsappNumber?: string | null;
  instagramAccountId?: string | null;
  whatsAppConfigOverride?:
  | {
    provider: 'BUBBLEWHATS' | 'TWILIO' | 'D360';
    credentials: Record<string, string>;
    webhookSecret?: string | null;
  }
  | null;
  zipcode?: string | null;
  street?: string | null;
  streetNumber?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  operatingHours?: OperatingHours | null;
  isHeadquarters?: boolean;
  active?: boolean;
  requestingUserId?: string;
  requestingUserEmail?: string;
}

@Injectable()
export class UpdateTenantBranchUseCase {
  constructor(
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepository: ITenantRepository,
    private readonly tenantAuditService: TenantAuditService,
    private readonly billingCapacityService: TenantBillingCapacityService,
  ) { }

  async execute(input: UpdateTenantBranchInput) {
    const currentBranch = (await this.tenantRepository.listBranches(input.tenantId)).find(
      (branch) => branch.id.toValue() === input.branchId,
    );

    const isActivatingBranch = input.active !== false && currentBranch?.active === false;
    const isAddingWhatsapp =
      !!input.whatsappNumber?.trim() &&
      input.whatsappNumber.replace(/\D/g, '') !==
        (currentBranch?.whatsappNumber ?? '').replace(/\D/g, '');

    if (isActivatingBranch) {
      await this.billingCapacityService.assertCanAdd(input.tenantId, 'branches');
    }

    if (isAddingWhatsapp) {
      await this.billingCapacityService.assertCanAdd(input.tenantId, 'whatsappNumbers');
    }

    const branch = await this.tenantRepository.updateBranch(input.branchId, {
      tenantId: input.tenantId,
      name: input.name,
      cnpj: input.cnpj ?? null,
      phone: input.phone,
      email: input.email,
      whatsappNumber: input.whatsappNumber,
      instagramAccountId: input.instagramAccountId,
      whatsAppConfigOverride: input.whatsAppConfigOverride ?? null,
      zipcode: input.zipcode,
      street: input.street,
      streetNumber: input.streetNumber,
      neighborhood: input.neighborhood,
      city: input.city,
      state: input.state,
      operatingHours: input.operatingHours ?? null,
      isHeadquarters: input.isHeadquarters,
      active: input.active,
    });

    await this.tenantAuditService.record({
      tenantId: input.tenantId,
      eventType: 'BRANCH_UPDATED',
      userId: input.requestingUserId,
      email: input.requestingUserEmail,
      metadata: {
        branchId: branch.id.toValue(),
        branchName: branch.name,
        isHeadquarters: branch.isHeadquarters,
        active: branch.active,
      },
    });

    return {
      success: true,
      data: {
        id: branch.id.toValue(),
        name: branch.name,
      },
    };
  }
}
