import { Injectable, Inject, ConflictException } from '@nestjs/common';
import { IUseCase } from '@shared/application/IUseCase';
import {
  ITenantRepository,
  TENANT_REPOSITORY,
} from '../../domain/repositories/ITenantRepository';
import { Tenant } from '../../domain/entities/Tenant';
import { CompanyName } from '../../domain/value-objects/CompanyName';
import { CNPJ } from '../../domain/value-objects/CNPJ';
import { Plan } from '../../domain/value-objects/Plan';
import { User } from '../../domain/entities/User';
import { Role } from '../../domain/value-objects/Role';
import { Email } from '../../domain/value-objects/Email';
import { Phone } from '../../domain/value-objects/Phone';

export interface CreateExternalTenantInput {
  companyName: string;
  cnpj: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
}

@Injectable()
export class CreateExternalTenantUseCase implements IUseCase<
  CreateExternalTenantInput,
  { apiKey: string }
> {
  constructor(
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepository: ITenantRepository,
  ) {}

  async execute(input: CreateExternalTenantInput): Promise<{ apiKey: string }> {
    const cnpjVO = CNPJ.create(input.cnpj);
    const exists = await this.tenantRepository.exists(cnpjVO.toClean());
    if (exists) {
      throw new ConflictException(
        `Tenant with CNPJ ${input.cnpj} already exists`,
      );
    }

    const ownerUser = User.create({
      name: input.ownerName,
      email: Email.create(input.ownerEmail),
      phone: Phone.create(input.ownerPhone),
      passwordHash: 'external-provider-password',
      role: Role.create('OWNER'),
    });

    const tenant = Tenant.create({
      companyName: CompanyName.create(input.companyName),
      cnpj: cnpjVO,
      plan: Plan.create('ESSENCIAL'),
      users: [ownerUser],
    });

    await this.tenantRepository.save(tenant);

    return { apiKey: tenant.apiKey };
  }
}
