import { GetWhatsAppConnectionUseCase } from '../application/use-cases/GetWhatsAppConnectionUseCase.js';
import { ITenantRepository } from '../domain/repositories/ITenantRepository.js';
import { ConfigService } from '@nestjs/config';
import { Tenant } from '../domain/entities/Tenant.js';
import { UniqueEntityID } from '@shared/domain/UniqueEntityID';
import { CompanyName } from '../domain/value-objects/CompanyName';
import { Plan } from '../domain/value-objects/Plan';
import { CNPJ } from '../domain/value-objects/CNPJ';
import { NotFoundException } from '@nestjs/common';
import { WhatsAppConfig } from '../domain/entities/WhatsAppConfig';

describe('GetWhatsAppConnectionUseCase', () => {
  let useCase: GetWhatsAppConnectionUseCase;
  let tenantRepository: jest.Mocked<ITenantRepository>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    tenantRepository = {
      findById: jest.fn(),
    } as any;

    configService = {
      get: jest.fn(),
    } as any;

    useCase = new GetWhatsAppConnectionUseCase(tenantRepository, configService);
  });

  it('should return connection info when WhatsApp is configured', async () => {
    const tenantId = 'tenant-1';

    const whatsAppConfig = WhatsAppConfig.create({
      provider: 'TWILIO',
      whatsappNumber: '5511999998888',
      credentials: {
        senderId: 'sender-1',
        senderSid: 'sid-1',
        wabaId: 'waba-1'
      },
      webhookSecret: null
    });

    const tenant = Tenant.reconstitute({
      companyName: CompanyName.create('Test Corp'),
      cnpj: CNPJ.create('12345678000195'),
      plan: Plan.essencial(),
      planStatus: 'ACTIVE',
      ownerUserId: 'user-1',
      users: [],
      whatsAppConfig: whatsAppConfig,
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

    configService.get.mockImplementation((key: string) => {
      if (key === 'TWILIO_EMBEDDED_SIGNUP_APP_ID') return 'app-123';
      if (key === 'TWILIO_EMBEDDED_SIGNUP_CONFIGURATION_ID') return 'conf-123';
      if (key === 'TWILIO_EMBEDDED_SIGNUP_SOLUTION_ID') return 'sol-123';
      return null;
    });

    const result = await useCase.execute(tenantId);

    expect(result.connection).toEqual({
      provider: 'TWILIO',
      status: 'PENDING_VERIFICATION',
      whatsappNumber: '5511999998888',
      senderId: 'sender-1',
      senderSid: 'sid-1',
      wabaId: 'waba-1',
    });
    expect(result.embeddedSignupReady).toBe(true);
    expect(result.embeddedSignup.appId).toBe('app-123');
  });

  it('should return null connection when WhatsApp is not configured', async () => {
    const tenantId = 'tenant-1';
    const tenant = Tenant.reconstitute({
      companyName: CompanyName.create('Test Corp'),
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

    tenantRepository.findById.mockResolvedValue(tenant);
    configService.get.mockReturnValue(null);

    const result = await useCase.execute(tenantId);

    expect(result.connection).toBeNull();
    expect(result.embeddedSignupReady).toBe(false);
  });

  it('should throw NotFoundException if tenant is not found', async () => {
    tenantRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute('invalid-id')).rejects.toThrow(NotFoundException);
  });
});
