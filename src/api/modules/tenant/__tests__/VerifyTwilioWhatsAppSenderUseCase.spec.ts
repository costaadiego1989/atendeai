import { VerifyTwilioWhatsAppSenderUseCase } from '../application/use-cases/VerifyTwilioWhatsAppSenderUseCase.js';
import { ITenantRepository } from '../domain/repositories/ITenantRepository.js';
import { TwilioManagementAcl } from '../infrastructure/acl/TwilioManagementAcl.js';
import { TenantDomainEventPublisher } from '../application/services/TenantDomainEventPublisher.js';
import { Tenant } from '../domain/entities/Tenant.js';
import { UniqueEntityID } from '@shared/domain/UniqueEntityID';
import { CompanyName } from '../domain/value-objects/CompanyName';
import { CNPJ } from '../domain/value-objects/CNPJ';
import { Plan } from '../domain/value-objects/Plan';
import { WhatsAppConfig } from '../domain/entities/WhatsAppConfig';
import { TenantBranch } from '../domain/entities/TenantBranch';
import { Address } from '../domain/value-objects/Address';

describe('VerifyTwilioWhatsAppSenderUseCase', () => {
  let useCase: VerifyTwilioWhatsAppSenderUseCase;
  let tenantRepository: jest.Mocked<ITenantRepository>;
  let twilioManagementAcl: jest.Mocked<TwilioManagementAcl>;
  let tenantDomainEventPublisher: jest.Mocked<TenantDomainEventPublisher>;

  beforeEach(() => {
    tenantRepository = {
      findById: jest.fn(),
      save: jest.fn(),
      listBranches: jest.fn(),
      updateBranch: jest.fn(),
    } as any;

    twilioManagementAcl = {
      verifySender: jest.fn(),
    } as any;

    tenantDomainEventPublisher = {
      publishFromAggregate: jest.fn(),
    } as any;

    useCase = new VerifyTwilioWhatsAppSenderUseCase(
      tenantRepository,
      twilioManagementAcl,
      tenantDomainEventPublisher,
    );
  });

  it('should verify sender and activate config when status is ONLINE', async () => {
    const tenantId = 'tenant-1';
    const whatsAppConfig = WhatsAppConfig.create({
      provider: 'TWILIO',
      whatsappNumber: '5511999998888',
      credentials: { senderSid: 'sid-123', wabaId: 'waba-old' },
      webhookSecret: null
    });

    const tenant = Tenant.reconstitute({
      companyName: CompanyName.create('Test'),
      cnpj: CNPJ.create('12345678000195'),
      plan: Plan.essencial(),
      planStatus: 'ACTIVE',
      ownerUserId: 'user-1',
      users: [],
      whatsAppConfig,
      instagramConfig: null,
      aiConfig: null,
      businessType: null,
      ownerBirthDate: null,
      description: null,
      services: null,
      address: null,
      catalogUrl: null,
      catalogFiles: [],
      operatingHours: null,
      promotions: [],
      apiKey: 'api-key',
    }, new UniqueEntityID(tenantId));

    tenantRepository.findById.mockResolvedValue(tenant);
    twilioManagementAcl.verifySender.mockResolvedValue({
      sid: 'sid-123',
      senderId: 'sender-123',
      status: 'ONLINE',
      configuration: { wabaId: 'waba-new' }
    } as any);

    const result = await useCase.execute({
      tenantId,
      verificationCode: '123456'
    });

    expect(result.status).toBe('ONLINE');
    expect(tenant.whatsAppConfig?.status).toBe('ACTIVE');
    expect(tenant.whatsAppConfig?.credentials.wabaId).toBe('waba-new');
    expect(tenantRepository.save).toHaveBeenCalled();
    expect(tenantDomainEventPublisher.publishFromAggregate).toHaveBeenCalled();
  });

  it('should verify sender in a branch scope when branchId is provided', async () => {
    const tenantId = 'tenant-branch';
    const tenant = Tenant.reconstitute({
      companyName: CompanyName.create('Test'),
      cnpj: CNPJ.create('12345678000195'),
      plan: Plan.essencial(),
      planStatus: 'ACTIVE',
      ownerUserId: 'user-1',
      users: [],
      whatsAppConfig: null,
      instagramConfig: null,
      aiConfig: null,
      businessType: null,
      ownerBirthDate: null,
      description: null,
      services: null,
      address: null,
      catalogUrl: null,
      catalogFiles: [],
      operatingHours: null,
      promotions: [],
      apiKey: 'api-key',
    }, new UniqueEntityID(tenantId));
    const branch = TenantBranch.create({
      tenantId,
      name: 'Filial Norte',
      cnpj: null,
      phone: null,
      email: null,
      whatsappNumber: '5521999991111',
      instagramAccountId: null,
      whatsAppConfigOverride: {
        provider: 'TWILIO',
        credentials: { senderSid: 'sid-branch', wabaId: 'waba-old' },
        webhookSecret: null,
      },
      address: Address.create({
        zipcode: '22000-000',
        street: 'Rua A',
        streetNumber: '1',
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
    twilioManagementAcl.verifySender.mockResolvedValue({
      sid: 'sid-branch',
      senderId: 'sender-branch',
      status: 'ONLINE',
      configuration: { wabaId: 'waba-new' },
    } as any);

    const result = await useCase.execute({
      tenantId,
      branchId: branch.id.toValue(),
      verificationCode: '123456',
    });

    expect(result.status).toBe('ACTIVE');
    expect(tenantRepository.updateBranch).toHaveBeenCalledWith(
      branch.id.toValue(),
      expect.objectContaining({
        whatsAppConfigOverride: expect.objectContaining({
          provider: 'TWILIO',
          credentials: expect.objectContaining({
            senderSid: 'sid-branch',
            senderStatus: 'ACTIVE',
            wabaId: 'waba-new',
          }),
        }),
      }),
    );
    expect(tenantRepository.save).not.toHaveBeenCalled();
  });
});
