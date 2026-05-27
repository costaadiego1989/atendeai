import { Inject, Injectable } from '@nestjs/common';
import {
  IPasswordHasher,
  PASSWORD_HASHER,
} from '@shared/application/ports/IPasswordHasher';
import { Tenant } from '../../domain/entities/Tenant';
import { User } from '../../domain/entities/User';
import { Role } from '../../domain/value-objects/Role';
import { CompanyName } from '../../domain/value-objects/CompanyName';
import { CNPJ } from '../../domain/value-objects/CNPJ';
import { Email } from '../../domain/value-objects/Email';
import { Phone } from '../../domain/value-objects/Phone';
import { Plan } from '../../domain/value-objects/Plan';
import {
  ITenantRepository,
  TENANT_REPOSITORY,
} from '../../domain/repositories/ITenantRepository';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '../../domain/repositories/IUserRepository';
import { ValidationErrorException } from '../../../../shared/domain/exceptions/DomainExceptions';
import { CPF } from '../../../../shared/domain/CPF';
import {
  ICreateTenantUseCase,
  CreateTenantInput,
  CreateTenantOutput,
} from './interfaces/ICreateTenantUseCase';
import { TenantDomainEventPublisher } from '../services/TenantDomainEventPublisher';

@Injectable()
export class CreateTenantUseCase implements ICreateTenantUseCase {
  constructor(
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepo: ITenantRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepo: IUserRepository,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: IPasswordHasher,
    private readonly tenantDomainEventPublisher: TenantDomainEventPublisher,
  ) {}

  async execute(input: CreateTenantInput): Promise<CreateTenantOutput> {
    const cnpjVO = CNPJ.create(input.cnpj);
    const exists = await this.tenantRepo.exists(cnpjVO.value);
    if (exists) {
      throw new ValidationErrorException('CNPJ already registered');
    }

    const emailVO = Email.create(input.ownerEmail);
    const existingUser = await this.userRepo.findByEmail(emailVO.value);
    if (existingUser) {
      throw new ValidationErrorException('Email already registered');
    }

    const companyName = CompanyName.create(input.companyName);
    const cpf = input.ownerCpf ? CPF.create(input.ownerCpf) : null;
    const phone = Phone.create(input.ownerPhone);
    const plan = Plan.create(input.plan ?? 'TRIAL');
    const passwordHash = await this.passwordHasher.hash(input.ownerPassword);

    const ownerUser = User.create({
      name: input.ownerName,
      email: emailVO,
      cpf,
      phone,
      passwordHash,
      role: Role.create('OWNER'),
    });

    const tenant = Tenant.create({
      companyName,
      cnpj: cnpjVO,
      plan,
      users: [ownerUser],
      ownerPassword: input.ownerPassword,
      isTrial: input.isTrial || false,
    });

    if (input.businessType) {
      tenant.updateBusinessData({
        businessType: input.businessType,
      });
    }

    await this.tenantRepo.save(tenant);
    await this.tenantDomainEventPublisher.publishFromAggregate(tenant);

    return {
      id: tenant.id.toValue(),
      companyName: tenant.companyName.value,
      cnpj: tenant.cnpj.value,
      plan: tenant.plan.value,
      owner: {
        id: ownerUser.id.toValue(),
        name: ownerUser.name,
        email: ownerUser.email.value,
      },
      createdAt: tenant.createdAt,
    };
  }
}
