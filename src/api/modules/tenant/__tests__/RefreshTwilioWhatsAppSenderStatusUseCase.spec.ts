import { RefreshTwilioWhatsAppSenderStatusUseCase } from '../application/use-cases/RefreshTwilioWhatsAppSenderStatusUseCase.js';
import { ITenantRepository } from '../domain/repositories/ITenantRepository.js';
import { TwilioManagementAcl } from '../infrastructure/acl/TwilioManagementAcl.js';
import { TenantDomainEventPublisher } from '../application/services/TenantDomainEventPublisher.js';
import { Tenant } from '../domain/entities/Tenant.js';
import { UniqueEntityID } from '@shared/domain/UniqueEntityID';
import { CompanyName } from '../domain/value-objects/CompanyName';
import { CNPJ } from '../domain/value-objects/CNPJ';
import { Plan } from '../domain/value-objects/Plan';
import { EntityNotFoundException } from '@shared/domain/exceptions/DomainExceptions';
import { WhatsAppConfig } from '../domain/entities/WhatsAppConfig';
import { TenantBranch } from '../domain/entities/TenantBranch';
import { Address } from '../domain/value-objects/Address';

describe('RefreshTwilioWhatsAppSenderStatusUseCase', () => {
  let useCase: RefreshTwilioWhatsAppSenderStatusUseCase;
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
      getSender: jest.fn(),
    } as any;

    tenantDomainEventPublisher = {
      publishFromAggregate: jest.fn(),
    } as any;

    useCase = new RefreshTwilioWhatsAppSenderStatusUseCase(
      tenantRepository,
      twilioManagementAcl,
      tenantDomainEventPublisher,
    );
  });

  it('should refresh status and activate config when sender is ONLINE', async () => {
    const tenantId = 'tenant-1';
    const whatsAppConfig = WhatsAppConfig.create({
      provider: 'TWILIO',
      whatsappNumber: '5511999998888',
      credentials: { senderSid: 'sid-123' },
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
      operatingHours: null,
      promotions: [],
      apiKey: 'api-key',
    }, new UniqueEntityID(tenantId));

    tenantRepository.findById.mockResolvedValue(tenant);
    twilioManagementAcl.getSender.mockResolvedValue({
      sid: 'sid-123',
      senderId: 'sender-123',
      status: 'ONLINE',
      configuration: { wabaId: 'waba-123' }
    } as any);

    const result = await useCase.execute(tenantId);

    expect(result.status).toBe('ONLINE');
    expect(tenant.whatsAppConfig?.status).toBe('ACTIVE');
    expect(tenantRepository.save).toHaveBeenCalled();
    expect(tenantDomainEventPublisher.publishFromAggregate).toHaveBeenCalled();
  });

  it('should throw EntityNotFoundException if tenant has no WhatsApp config', async () => {
    tenantRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute('none')).rejects.toThrow(EntityNotFoundException);
  });

  it('should throw error if provider is not TWILIO', async () => {
     const tenant = Tenant.reconstitute({
      companyName: CompanyName.create('Test'),
      cnpj: CNPJ.create('12345678000195'),
      plan: Plan.essencial(),
      planStatus: 'ACTIVE',
      ownerUserId: 'user-1',
      users: [],
      whatsAppConfig: WhatsAppConfig.create({ 
        provider: 'BUBBLEWHATS', 
        whatsappNumber: '1', 
        credentials: { id: '7071', token: 'token', apiUrl: 'http://test' },
        webhookSecret: null
      }),
      instagramConfig: null,
      aiConfig: null,
      businessType: null,
      ownerBirthDate: null,
      description: null,
      services: null,
      address: null,
      catalogUrl: null,
      operatingHours: null,
      promotions: [],
      apiKey: 'api-key',
    } as any, new UniqueEntityID('t1'));

    tenantRepository.findById.mockResolvedValue(tenant);

    await expect(useCase.execute('t1')).rejects.toThrow('Tenant WhatsApp provider is not Twilio');
  });

  it('should refresh sender status in a branch scope', async () => {
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
      operatingHours: null,
      promotions: [],
      apiKey: 'api-key',
    }, new UniqueEntityID(tenantId));
    const branch = TenantBranch.create({
      tenantId,
      name: 'Filial Sul',
      cnpj: null,
      phone: null,
      email: null,
      whatsappNumber: '5521988887777',
      instagramAccountId: null,
      whatsAppConfigOverride: {
        provider: 'TWILIO',
        credentials: { senderSid: 'sid-branch' },
        webhookSecret: null,
      },
      address: Address.create({
        zipcode: '22000-000',
        street: 'Rua B',
        streetNumber: '2',
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
    twilioManagementAcl.getSender.mockResolvedValue({
      sid: 'sid-branch',
      senderId: 'sender-branch',
      status: 'ONLINE',
      configuration: { wabaId: 'waba-branch' },
    } as any);

    const result = await useCase.execute(tenantId, branch.id.toValue());

    expect(result.status).toBe('ACTIVE');
    expect(tenantRepository.updateBranch).toHaveBeenCalledWith(
      branch.id.toValue(),
      expect.objectContaining({
        whatsAppConfigOverride: expect.objectContaining({
          provider: 'TWILIO',
          credentials: expect.objectContaining({
            senderSid: 'sid-branch',
            senderStatus: 'ACTIVE',
            wabaId: 'waba-branch',
          }),
        }),
      }),
    );
  });
});
