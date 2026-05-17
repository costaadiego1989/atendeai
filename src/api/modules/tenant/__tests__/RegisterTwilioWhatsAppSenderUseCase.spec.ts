import { RegisterTwilioWhatsAppSenderUseCase } from '../application/use-cases/RegisterTwilioWhatsAppSenderUseCase';
import { ITenantRepository } from '../domain/repositories/ITenantRepository';
import { Tenant } from '../domain/entities/Tenant';
import { CompanyName } from '../domain/value-objects/CompanyName';
import { CNPJ } from '../domain/value-objects/CNPJ';
import { Plan } from '../domain/value-objects/Plan';
import { User } from '../domain/entities/User';
import { Email } from '../domain/value-objects/Email';
import { Phone } from '../domain/value-objects/Phone';
import { Role } from '../domain/value-objects/Role';
import { TwilioManagementAcl } from '../infrastructure/acl/TwilioManagementAcl';
import { TenantDomainEventPublisher } from '../application/services/TenantDomainEventPublisher';
import { TenantBranch } from '../domain/entities/TenantBranch';
import { Address } from '../domain/value-objects/Address';

describe('RegisterTwilioWhatsAppSenderUseCase', () => {
  let tenantRepository: jest.Mocked<ITenantRepository>;
  let twilioManagementAcl: jest.Mocked<TwilioManagementAcl>;
  let tenantDomainEventPublisher: jest.Mocked<TenantDomainEventPublisher>;
  let tenantTwilioAccountService: {
    ensureTenantAccount: jest.Mock;
    toCredentials: jest.Mock;
  };
  let billingCapacityService: { assertCanAdd: jest.Mock };
  let useCase: RegisterTwilioWhatsAppSenderUseCase;

  beforeEach(() => {
    tenantRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findCompanyNameById: jest.fn(),
      findByCnpj: jest.fn(),
      findByWhatsAppNumber: jest.fn(),
      findByApiKey: jest.fn(),
      findAll: jest.fn(),
      exists: jest.fn(),
      listBranches: jest.fn().mockResolvedValue([]),
      createBranch: jest.fn(),
      updateBranch: jest.fn(),
      deleteBranch: jest.fn(),
    } as any;

    twilioManagementAcl = {
      createSender: jest.fn(),
    } as any;

    tenantDomainEventPublisher = {
      publishFromAggregate: jest.fn(),
    } as any;

    tenantTwilioAccountService = {
      ensureTenantAccount: jest.fn().mockResolvedValue({
        accountSid: 'AC_SUB',
        authToken: 'sub-token',
      }),
      toCredentials: jest.fn().mockReturnValue({
        accountSid: 'AC_SUB',
        authToken: 'sub-token',
      }),
    };

    billingCapacityService = {
      assertCanAdd: jest.fn(),
    };

    useCase = new RegisterTwilioWhatsAppSenderUseCase(
      tenantRepository,
      twilioManagementAcl,
      tenantDomainEventPublisher,
      {
        get: jest.fn((key: string) => {
          if (key === 'TWILIO_WHATSAPP_WEBHOOK_URL') {
            return 'https://app.example.com/api/v1/webhooks/whatsapp';
          }
          return undefined;
        }),
      } as any,
      tenantTwilioAccountService as any,
      billingCapacityService as any,
    );
  });

  it('should create and persist a Twilio sender in pending verification', async () => {
    const tenant = Tenant.create({
      companyName: CompanyName.create('Acme Corp'),
      cnpj: CNPJ.create('60.701.190/0001-04'),
      plan: Plan.create('ESSENCIAL'),
      users: [
        User.create({
          name: 'Owner Name',
          email: Email.create('owner@acme.com'),
          phone: Phone.create('11999998888'),
          passwordHash: 'hashed-password',
          role: Role.create('OWNER'),
        }),
      ],
    });
    tenant.clearEvents();
    tenantRepository.findById.mockResolvedValue(tenant);
    twilioManagementAcl.createSender.mockResolvedValue({
      sid: 'XE123',
      status: 'PENDING_VERIFICATION',
      senderId: 'whatsapp:+5511999999999',
      configuration: {
        wabaId: 'waba-123',
        verificationMethod: 'sms',
      },
    });

    const result = await useCase.execute({
      tenantId: tenant.id.toValue(),
      phoneNumber: '+55 11 99999-9999',
      wabaId: 'waba-123',
    });

    expect(result).toEqual(
      expect.objectContaining({
        provider: 'TWILIO',
        senderSid: 'XE123',
        status: 'PENDING_VERIFICATION',
        verificationRequired: true,
      }),
    );
    expect(tenant.whatsAppConfig?.provider).toBe('TWILIO');
    expect(tenant.whatsAppConfig?.credentials).toEqual({
      accountSid: 'AC_SUB',
      authToken: 'sub-token',
      senderSid: 'XE123',
      senderId: 'whatsapp:+5511999999999',
      wabaId: 'waba-123',
    });
    expect(billingCapacityService.assertCanAdd).toHaveBeenCalledWith(
      tenant.id.toValue(),
      'whatsappNumbers',
    );
    expect(tenantRepository.save).toHaveBeenCalledWith(tenant);
    expect(
      tenantDomainEventPublisher.publishFromAggregate,
    ).toHaveBeenCalledWith(tenant);
  });

  it('should save Twilio sender in a branch scope when branchId is provided', async () => {
    const tenant = Tenant.create({
      companyName: CompanyName.create('Acme Corp'),
      cnpj: CNPJ.create('60.701.190/0001-04'),
      plan: Plan.create('ESSENCIAL'),
      users: [],
    });
    const branch = TenantBranch.create({
      tenantId: tenant.id.toValue(),
      name: 'Filial Centro',
      cnpj: null,
      phone: null,
      email: null,
      whatsappNumber: null,
      instagramAccountId: null,
      whatsAppConfigOverride: null,
      address: Address.create({
        zipcode: '22000-000',
        street: 'Rua A',
        streetNumber: '10',
        neighborhood: 'Centro',
        city: 'Rio de Janeiro',
        state: 'RJ',
      }),
      operatingHours: null,
      isHeadquarters: false,
      active: true,
    });

    tenantRepository.findById.mockResolvedValue(tenant);
    tenantRepository.listBranches.mockResolvedValue([branch]);
    twilioManagementAcl.createSender.mockResolvedValue({
      sid: 'XE999',
      status: 'PENDING_VERIFICATION',
      senderId: 'whatsapp:+5521999990000',
      configuration: {
        wabaId: 'waba-branch',
        verificationMethod: 'sms',
      },
    });

    await useCase.execute({
      tenantId: tenant.id.toValue(),
      branchId: branch.id.toValue(),
      phoneNumber: '+55 21 99999-0000',
      wabaId: 'waba-branch',
    });

    expect(tenantRepository.updateBranch).toHaveBeenCalledWith(
      branch.id.toValue(),
      expect.objectContaining({
        tenantId: tenant.id.toValue(),
        name: 'Filial Centro',
        whatsappNumber: '5521999990000',
        whatsAppConfigOverride: expect.objectContaining({
          provider: 'TWILIO',
          credentials: expect.objectContaining({
            senderSid: 'XE999',
            senderStatus: 'PENDING_VERIFICATION',
          }),
        }),
      }),
    );
    expect(tenantRepository.save).not.toHaveBeenCalled();
    expect(billingCapacityService.assertCanAdd).toHaveBeenCalledWith(
      tenant.id.toValue(),
      'whatsappNumbers',
    );
  });

  it('should prepend country code when the input has only DDD and local number', async () => {
    const tenant = Tenant.create({
      companyName: CompanyName.create('Acme Corp'),
      cnpj: CNPJ.create('60.701.190/0001-04'),
      plan: Plan.create('ESSENCIAL'),
      users: [],
    });

    tenantRepository.findById.mockResolvedValue(tenant);
    twilioManagementAcl.createSender.mockResolvedValue({
      sid: 'XE124',
      status: 'PENDING_VERIFICATION',
      senderId: 'whatsapp:+5521999990000',
      configuration: {
        wabaId: 'waba-124',
        verificationMethod: 'sms',
      },
    });

    const result = await useCase.execute({
      tenantId: tenant.id.toValue(),
      phoneNumber: '(21) 99999-0000',
      wabaId: 'waba-124',
    });

    expect(twilioManagementAcl.createSender).toHaveBeenCalledWith(
      expect.objectContaining({
        senderId: 'whatsapp:+5521999990000',
      }),
      expect.objectContaining({
        tenantId: expect.any(String),
      }),
    );
    expect(result.whatsappNumber).toBe('5521999990000');
  });

  describe('normalizeBrazilPhone edge cases', () => {
    function setupTenantAndMock(normalizedNumber: string) {
      const tenant = Tenant.create({
        companyName: CompanyName.create('Acme Corp'),
        cnpj: CNPJ.create('60.701.190/0001-04'),
        plan: Plan.create('ESSENCIAL'),
        users: [],
      });
      tenantRepository.findById.mockResolvedValue(tenant);
      twilioManagementAcl.createSender.mockResolvedValue({
        sid: 'XE200',
        status: 'PENDING_VERIFICATION',
        senderId: `whatsapp:+${normalizedNumber}`,
        configuration: { wabaId: 'waba-norm', verificationMethod: 'sms' },
      });
      return tenant;
    }

    it('should prepend 55 for raw 11-digit mobile number', async () => {
      const tenant = setupTenantAndMock('5521993001883');
      const result = await useCase.execute({
        tenantId: tenant.id.toValue(),
        phoneNumber: '21993001883',
        wabaId: 'waba-norm',
      });
      expect(twilioManagementAcl.createSender).toHaveBeenCalledWith(
        expect.objectContaining({ senderId: 'whatsapp:+5521993001883' }),
        expect.anything(),
      );
      expect(result.whatsappNumber).toBe('5521993001883');
    });

    it('should keep number unchanged when already prefixed with 55', async () => {
      const tenant = setupTenantAndMock('5521993001883');
      const result = await useCase.execute({
        tenantId: tenant.id.toValue(),
        phoneNumber: '5521993001883',
        wabaId: 'waba-norm',
      });
      expect(twilioManagementAcl.createSender).toHaveBeenCalledWith(
        expect.objectContaining({ senderId: 'whatsapp:+5521993001883' }),
        expect.anything(),
      );
      expect(result.whatsappNumber).toBe('5521993001883');
    });

    it('should strip +55 prefix and non-digit chars', async () => {
      const tenant = setupTenantAndMock('5521993001883');
      const result = await useCase.execute({
        tenantId: tenant.id.toValue(),
        phoneNumber: '+55 21 99300-1883',
        wabaId: 'waba-norm',
      });
      expect(twilioManagementAcl.createSender).toHaveBeenCalledWith(
        expect.objectContaining({ senderId: 'whatsapp:+5521993001883' }),
        expect.anything(),
      );
      expect(result.whatsappNumber).toBe('5521993001883');
    });

    it('should prepend 55 for 10-digit landline number', async () => {
      const tenant = setupTenantAndMock('552199300188');
      const result = await useCase.execute({
        tenantId: tenant.id.toValue(),
        phoneNumber: '2199300188',
        wabaId: 'waba-norm',
      });
      expect(twilioManagementAcl.createSender).toHaveBeenCalledWith(
        expect.objectContaining({ senderId: 'whatsapp:+552199300188' }),
        expect.anything(),
      );
      expect(result.whatsappNumber).toBe('552199300188');
    });
  });
});
