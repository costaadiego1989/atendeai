import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  ITenantRepository,
  TENANT_REPOSITORY,
} from '../../domain/repositories/ITenantRepository';
import {
  IUpdateBusinessDataUseCase,
  UpdateBusinessDataInput,
  UpdateBusinessDataOutput,
} from './interfaces/IUpdateBusinessDataUseCase';
import { Address } from '../../domain/value-objects/Address';
import { TenantAuditService } from '../services/TenantAuditService';

@Injectable()
export class UpdateBusinessDataUseCase implements IUpdateBusinessDataUseCase {
  constructor(
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepository: ITenantRepository,
    private readonly tenantAuditService: TenantAuditService,
  ) {}

  async execute(
    input: UpdateBusinessDataInput,
  ): Promise<UpdateBusinessDataOutput> {
    const tenant = await this.tenantRepository.findById(input.tenantId);

    if (!tenant) {
      throw new NotFoundException(`Tenant with ID ${input.tenantId} not found`);
    }

    const address = Address.create({
      zipcode: input.zipcode || '',
      street: input.street || '',
      streetNumber: input.streetNumber || '',
      neighborhood: input.neighborhood || '',
      city: input.city || '',
      state: input.state || '',
    });

    tenant.updateBusinessData({
      businessType: input.businessType,
      ownerBirthDate: input.ownerBirthDate,
      description: input.description,
      services: input.services,
      address,
      catalogUrl: input.catalogUrl,
      catalogFiles: input.catalogFiles || [],
      operatingHours: input.operatingHours,
    });

    await this.tenantRepository.save(tenant);
    await this.tenantAuditService.record({
      tenantId: input.tenantId,
      userId: input.requestingUserId,
      email: input.requestingUserEmail,
      eventType: 'BUSINESS_DATA_UPDATED',
      metadata: {
        updatedFields: Object.keys(input).filter(
          (key) =>
            !['tenantId', 'requestingUserId', 'requestingUserEmail'].includes(
              key,
            ),
        ),
      },
    });

    return { success: true };
  }
}
