import {
  Inject,
  Injectable,
  ConflictException,
} from '@nestjs/common';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '../../../domain/repositories/IUserRepository';
import {
  ITenantRepository,
  TENANT_REPOSITORY,
} from '../../../domain/repositories/ITenantRepository';
import {
  IPasswordHasher,
  PASSWORD_HASHER,
} from '@shared/application/ports/IPasswordHasher';
import { UserDomainEventPublisher } from '../../services/UserDomainEventPublisher';
import { User } from '../../../domain/entities/User';
import { Email } from '../../../domain/value-objects/Email';
import { Phone } from '../../../domain/value-objects/Phone';
import { Role, RoleType } from '../../../domain/value-objects/Role';
import {
  ITeamMemberCredentialsEmailSender,
  TEAM_MEMBER_CREDENTIALS_EMAIL_SENDER,
} from '../../ports/ITeamMemberCredentialsEmailSender';
import { randomBytes } from 'crypto';
import { TenantBillingCapacityService } from '@shared/infrastructure/billing/TenantBillingCapacityService';

export interface CreateUserInput {
  tenantId: string;
  name: string;
  email: string;
  phone: string;
  role: RoleType;
}

@Injectable()
export class CreateUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepo: IUserRepository,
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepo: ITenantRepository,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: IPasswordHasher,
    @Inject(TEAM_MEMBER_CREDENTIALS_EMAIL_SENDER)
    private readonly teamMemberCredentialsEmailSender: ITeamMemberCredentialsEmailSender,
    private readonly userDomainEventPublisher: UserDomainEventPublisher,
    private readonly billingCapacityService: TenantBillingCapacityService,
  ) {}

  async execute(input: CreateUserInput): Promise<{ id: string }> {
    await this.billingCapacityService.assertCanAdd(input.tenantId, 'users');

    const existingUser = await this.userRepo.findByEmail(input.email);
    if (existingUser) {
      throw new ConflictException('A user with this email already exists.');
    }

    const tenantCompanyName =
      (await this.tenantRepo.findCompanyNameById?.(input.tenantId)) ??
      (await this.tenantRepo.findById(input.tenantId))?.companyName.value ??
      null;

    if (!tenantCompanyName) {
      throw new ConflictException('Tenant not found.');
    }

    const temporaryPassword = this.generateTemporaryPassword();
    const passwordHash = await this.passwordHasher.hash(temporaryPassword);

    const user = User.create({
      name: input.name,
      email: Email.create(input.email),
      phone: Phone.create(input.phone),
      passwordHash,
      role: Role.create(input.role),
    });
    user.requirePasswordChange();

    await this.userRepo.saveWithTenant(user, input.tenantId);
    await this.userDomainEventPublisher.publishFromAggregate(user, input.tenantId);
    await this.teamMemberCredentialsEmailSender.send({
      email: input.email,
      name: input.name,
      temporaryPassword,
      loginUrl: process.env['APP_LOGIN_URL_BASE'] || 'http://localhost:8080/login',
      tenantName: tenantCompanyName,
    });

    return { id: user.id.toValue() };
  }

  private generateTemporaryPassword(): string {
    return `Atd!${randomBytes(4).toString('hex')}`;
  }
}
