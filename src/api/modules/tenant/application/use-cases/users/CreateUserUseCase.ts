import {
  Inject,
  Injectable,
  ConflictException,
  Optional,
  Logger,
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
import {
  IMessagingFacade,
  MESSAGING_FACADE,
} from '@modules/messaging/application/facades/MessagingFacade';
import {
  IContactFacade,
  CONTACT_FACADE,
} from '@modules/contact/application/facades/ContactFacade';
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
  private readonly logger = new Logger(CreateUserUseCase.name);

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
    @Optional()
    @Inject(MESSAGING_FACADE)
    private readonly messagingFacade?: IMessagingFacade,
    @Optional()
    @Inject(CONTACT_FACADE)
    private readonly contactFacade?: IContactFacade,
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

    const loginUrl = process.env['APP_LOGIN_URL_BASE'] || 'http://localhost:8080/login';

    try {
      await this.teamMemberCredentialsEmailSender.send({
        email: input.email,
        name: input.name,
        temporaryPassword,
        loginUrl,
        tenantName: tenantCompanyName,
      });
    } catch (error) {
      this.logger.warn(
        `Failed to send credentials email to ${input.email}: ${(error as Error).message}`,
      );
    }

    await this.sendWhatsAppCredentials(input, temporaryPassword, tenantCompanyName);

    return { id: user.id.toValue() };
  }

  private async sendWhatsAppCredentials(
    input: CreateUserInput,
    temporaryPassword: string,
    tenantName: string,
  ): Promise<void> {
    if (!this.messagingFacade || !this.contactFacade) {
      return;
    }

    try {
      const { contactId } = await this.contactFacade.ensureContact({
        tenantId: input.tenantId,
        name: input.name,
        phone: input.phone,
        email: input.email,
        tags: ['equipe-interna'],
      });

      const loginUrl = process.env['APP_LOGIN_URL_BASE'] || 'http://localhost:8080/login';
      const message = [
        `Olá ${input.name}! Você foi adicionado(a) à equipe *${tenantName}* no AtendeAi.`,
        '',
        `Acesse: ${loginUrl}`,
        `E-mail: ${input.email}`,
        `Senha temporária: ${temporaryPassword}`,
        '',
        'Troque a senha no primeiro acesso.',
      ].join('\n');

      await this.messagingFacade.queueSystemMessage({
        tenantId: input.tenantId,
        contactId,
        channel: 'WHATSAPP',
        text: message,
      });
    } catch (error) {
      this.logger.warn(
        `Failed to send WhatsApp credentials to ${input.phone}: ${(error as Error).message}`,
      );
    }
  }

  private generateTemporaryPassword(): string {
    return `Atd!${randomBytes(4).toString('hex')}`;
  }
}
