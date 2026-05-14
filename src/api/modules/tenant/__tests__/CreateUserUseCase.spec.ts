import { ConflictException } from '@nestjs/common';
import { CreateUserUseCase } from '../application/use-cases/users/CreateUserUseCase';
import { IUserRepository } from '../domain/repositories/IUserRepository';
import { IPasswordHasher } from '@shared/application/ports/IPasswordHasher';
import { UserDomainEventPublisher } from '../application/services/UserDomainEventPublisher';
import { ITenantRepository } from '../domain/repositories/ITenantRepository';
import { ITeamMemberCredentialsEmailSender } from '../application/ports/ITeamMemberCredentialsEmailSender';
import { IMessagingFacade } from '@modules/messaging/application/facades/MessagingFacade';
import { IContactFacade } from '@modules/contact/application/facades/ContactFacade';
import { User } from '../domain/entities/User';
import { Email } from '../domain/value-objects/Email';
import { Phone } from '../domain/value-objects/Phone';
import { Role } from '../domain/value-objects/Role';
import { Tenant } from '../domain/entities/Tenant';
import { CompanyName } from '../domain/value-objects/CompanyName';
import { CNPJ } from '../domain/value-objects/CNPJ';
import { Plan } from '../domain/value-objects/Plan';

describe('CreateUserUseCase', () => {
  let useCase: CreateUserUseCase;
  let userRepo: jest.Mocked<IUserRepository>;
  let tenantRepo: jest.Mocked<ITenantRepository>;
  let passwordHasher: jest.Mocked<IPasswordHasher>;
  let teamMemberCredentialsEmailSender: jest.Mocked<ITeamMemberCredentialsEmailSender>;
  let userDomainEventPublisher: jest.Mocked<UserDomainEventPublisher>;
  let billingCapacityService: { assertCanAdd: jest.Mock };
  let messagingFacade: jest.Mocked<IMessagingFacade>;
  let contactFacade: jest.Mocked<IContactFacade>;

  beforeEach(() => {
    userRepo = {
      saveWithTenant: jest.fn(),
      save: jest.fn(),
      findById: jest.fn(),
      findByIdAndTenant: jest.fn(),
      findByEmail: jest.fn(),
      findAllByTenant: jest.fn(),
      findOwnerPrincipalByTenantId: jest.fn(),
      delete: jest.fn(),
    };

    passwordHasher = {
      hash: jest.fn(),
      compare: jest.fn(),
    };
    tenantRepo = {
      save: jest.fn(),
      findById: jest.fn(),
      findByCnpj: jest.fn(),
      findByWhatsAppNumber: jest.fn(),
      findByApiKey: jest.fn(),
      findAll: jest.fn(),
      exists: jest.fn(),
      listBranches: jest.fn().mockResolvedValue([]),
      createBranch: jest.fn(),
      updateBranch: jest.fn(),
      deleteBranch: jest.fn(),
    };
    teamMemberCredentialsEmailSender = {
      send: jest.fn(),
    };

    messagingFacade = {
      queueSystemMessage: jest.fn().mockResolvedValue({ conversationId: 'conv-1', messageId: 'msg-1' }),
    };

    contactFacade = {
      identifyContact: jest.fn(),
      getContactById: jest.fn(),
      ensureContact: jest.fn().mockResolvedValue({ contactId: 'contact-1', created: true }),
      upsertProspectContact: jest.fn(),
      findContactIdsForReengagementAudience: jest.fn(),
    };

    userDomainEventPublisher = {
      publishFromAggregate: jest.fn(),
    } as unknown as jest.Mocked<UserDomainEventPublisher>;

    billingCapacityService = {
      assertCanAdd: jest.fn(),
    };

    tenantRepo.findById.mockResolvedValue(
      Tenant.create({
        companyName: CompanyName.create('Tenant Teste'),
        cnpj: CNPJ.create('11.444.777/0001-61'),
        plan: Plan.create('PROFISSIONAL'),
        users: [],
      }),
    );

    useCase = new CreateUserUseCase(
      userRepo,
      tenantRepo,
      passwordHasher,
      teamMemberCredentialsEmailSender,
      userDomainEventPublisher,
      billingCapacityService as any,
      messagingFacade,
      contactFacade,
    );
  });

  it('should create a user with temporary password, require first access change and persist it with tenant ownership', async () => {
    userRepo.findByEmail.mockResolvedValue(null);
    passwordHasher.hash.mockResolvedValue('hashed-password');

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      name: 'John Admin',
      email: 'john@tenant.com',
      phone: '11999998888',
      role: 'ADMIN',
    });

    expect(passwordHasher.hash).toHaveBeenCalledWith(expect.stringMatching(/^Atd!/));
    expect(billingCapacityService.assertCanAdd).toHaveBeenCalledWith(
      'tenant-1',
      'users',
    );
    expect(userRepo.saveWithTenant).toHaveBeenCalledTimes(1);

    const savedUser = userRepo.saveWithTenant.mock.calls[0][0];
    const savedTenantId = userRepo.saveWithTenant.mock.calls[0][1];
    expect(savedTenantId).toBe('tenant-1');
    expect(savedUser.name).toBe('John Admin');
    expect(savedUser.email.value).toBe('john@tenant.com');
    expect(savedUser.role.value).toBe('ADMIN');
    expect(savedUser.passwordHash).toBe('hashed-password');
    expect(savedUser.mustChangePassword).toBe(true);
    expect(userDomainEventPublisher.publishFromAggregate).toHaveBeenCalledWith(
      savedUser,
      'tenant-1',
    );
    expect(teamMemberCredentialsEmailSender.send).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'john@tenant.com',
        name: 'John Admin',
        tenantName: 'Tenant Teste',
        temporaryPassword: expect.stringMatching(/^Atd!/),
      }),
    );
    expect(result.id).toBeDefined();
  });

  it('should send WhatsApp credentials via MessagingFacade after user creation', async () => {
    userRepo.findByEmail.mockResolvedValue(null);
    passwordHasher.hash.mockResolvedValue('hashed-password');

    await useCase.execute({
      tenantId: 'tenant-1',
      name: 'John Admin',
      email: 'john@tenant.com',
      phone: '11999998888',
      role: 'ADMIN',
    });

    expect(contactFacade.ensureContact).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        name: 'John Admin',
        phone: '11999998888',
        email: 'john@tenant.com',
        tags: ['equipe-interna'],
      }),
    );
    expect(messagingFacade.queueSystemMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        contactId: 'contact-1',
        channel: 'WHATSAPP',
        text: expect.stringContaining('Atd!'),
      }),
    );
  });

  it('should not fail user creation if WhatsApp notification fails', async () => {
    userRepo.findByEmail.mockResolvedValue(null);
    passwordHasher.hash.mockResolvedValue('hashed-password');
    contactFacade.ensureContact.mockRejectedValue(new Error('WhatsApp not configured'));

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      name: 'John Admin',
      email: 'john@tenant.com',
      phone: '11999998888',
      role: 'ADMIN',
    });

    expect(result.id).toBeDefined();
    expect(userRepo.saveWithTenant).toHaveBeenCalledTimes(1);
    expect(teamMemberCredentialsEmailSender.send).toHaveBeenCalledTimes(1);
  });

  it('should throw conflict when email is already in use', async () => {
    userRepo.findByEmail.mockResolvedValue(
      User.create({
        name: 'Existing User',
        email: Email.create('john@tenant.com'),
        phone: Phone.create('11999998888'),
        passwordHash: 'hash',
        role: Role.create('AGENT'),
      }),
    );

    await expect(
      useCase.execute({
        tenantId: 'tenant-1',
        name: 'John Admin',
        email: 'john@tenant.com',
        phone: '11999998888',
        role: 'ADMIN',
      }),
    ).rejects.toThrow(ConflictException);

    expect(passwordHasher.hash).not.toHaveBeenCalled();
    expect(userRepo.saveWithTenant).not.toHaveBeenCalled();
    expect(userDomainEventPublisher.publishFromAggregate).not.toHaveBeenCalled();
  });
});
