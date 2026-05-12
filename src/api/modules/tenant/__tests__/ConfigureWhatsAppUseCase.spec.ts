import { ConfigureWhatsAppUseCase } from '../application/use-cases/ConfigureWhatsAppUseCase';
import { ITenantRepository } from '../domain/repositories/ITenantRepository';
import { TenantDomainEventPublisher } from '../application/services/TenantDomainEventPublisher';
import { EntityNotFoundException } from '@shared/domain/exceptions/DomainExceptions';
import { Tenant } from '../domain/entities/Tenant';
import { CompanyName } from '../domain/value-objects/CompanyName';
import { CNPJ } from '../domain/value-objects/CNPJ';
import { Plan } from '../domain/value-objects/Plan';
import { User } from '../domain/entities/User';
import { Email } from '../domain/value-objects/Email';
import { Phone } from '../domain/value-objects/Phone';
import { Role } from '../domain/value-objects/Role';
import { BubbleWhatsConfigurationStrategy } from '../application/strategies/whatsapp/BubbleWhatsConfigurationStrategy';
import { Dialog360ConfigurationStrategy } from '../application/strategies/whatsapp/Dialog360ConfigurationStrategy';
import { WhatsAppConfigurationStrategyRegistry } from '../application/strategies/whatsapp/WhatsAppConfigurationStrategyRegistry';
import { Dialog360ManagementAcl } from '../infrastructure/acl/Dialog360ManagementAcl';
import { TenantAuditService } from '../application/services/TenantAuditService';
import { TenantBillingCapacityService } from '@shared/infrastructure/billing/TenantBillingCapacityService';

describe('ConfigureWhatsAppUseCase', () => {
  let useCase: ConfigureWhatsAppUseCase;
  let tenantRepo: jest.Mocked<ITenantRepository>;
  let tenantDomainEventPublisher: jest.Mocked<TenantDomainEventPublisher>;
  let dialog360ManagementAcl: jest.Mocked<Dialog360ManagementAcl>;
  let tenantAuditService: jest.Mocked<TenantAuditService>;
  let billingCapacityService: jest.Mocked<TenantBillingCapacityService>;

  beforeEach(() => {
    tenantRepo = {
      save: jest.fn(),
      findById: jest.fn(),
      findByCnpj: jest.fn(),
      findByWhatsAppNumber: jest.fn(),
      findByApiKey: jest.fn(),
      findAll: jest.fn(),
      listBranches: jest.fn().mockResolvedValue([]),
      createBranch: jest.fn(),
      updateBranch: jest.fn(),
      deleteBranch: jest.fn(),
      exists: jest.fn(),
    };

    tenantDomainEventPublisher = {
      publishFromAggregate: jest.fn(),
    } as unknown as jest.Mocked<TenantDomainEventPublisher>;

    dialog360ManagementAcl = {
      configurePhoneWebhook: jest.fn(),
    } as unknown as jest.Mocked<Dialog360ManagementAcl>;
    tenantAuditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<TenantAuditService>;

    billingCapacityService = {
      assertCanAdd: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<TenantBillingCapacityService>;

    const bubbleStrategy = new BubbleWhatsConfigurationStrategy();
    const d360Strategy = new Dialog360ConfigurationStrategy(
      {
        get: jest.fn((key: string) => {
          if (key === 'D360_BASE_URL') {
            return 'https://waba-v2.360dialog.io';
          }

          return undefined;
        }),
      } as any,
      dialog360ManagementAcl,
    );
    const strategyRegistry = new WhatsAppConfigurationStrategyRegistry(
      bubbleStrategy,
      d360Strategy,
    );

    useCase = new ConfigureWhatsAppUseCase(
      tenantRepo,
      tenantDomainEventPublisher,
      strategyRegistry,
      tenantAuditService,
      billingCapacityService,
    );
  });

  function makeTenant() {
    return Tenant.create({
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
  }

  it('should throw when the tenant does not exist', async () => {
    tenantRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({
        tenantId: 'missing-tenant',
        whatsappNumber: '5511999999999',
        bubbleWhatsId: '7071',
        bubbleWhatsToken: 'tenant-token',
        bubbleWhatsApiUrl: 'https://7071.bubblewhats.com',
      }),
    ).rejects.toThrow(EntityNotFoundException);

    expect(tenantRepo.save).not.toHaveBeenCalled();
    expect(tenantDomainEventPublisher.publishFromAggregate).not.toHaveBeenCalled();
  });

  it('should persist the whatsapp config and publish domain events', async () => {
    const tenant = makeTenant();
    tenant.clearEvents();
    tenantRepo.findById.mockResolvedValue(tenant);

    const result = await useCase.execute({
      tenantId: tenant.id.toValue(),
      whatsappNumber: '5511999999999',
      bubbleWhatsId: '7071',
      bubbleWhatsToken: 'tenant-token',
      bubbleWhatsApiUrl: 'https://7071.bubblewhats.com',
    });

    expect(tenantRepo.save).toHaveBeenCalledWith(tenant);
    expect(tenantDomainEventPublisher.publishFromAggregate).toHaveBeenCalledWith(
      tenant,
    );
    expect(result).toEqual(
      expect.objectContaining({
        provider: 'BUBBLEWHATS',
        whatsappNumber: '5511999999999',
        status: 'ACTIVE',
      }),
    );
    expect(tenant.whatsAppConfig?.provider).toBe('BUBBLEWHATS');
    expect(tenant.whatsAppConfig?.credentials).toEqual({
      id: '7071',
      token: 'tenant-token',
      apiUrl: 'https://7071.bubblewhats.com',
    });
  });

  it('should configure 360dialog and set webhook automatically when URL is provided', async () => {
    const tenant = makeTenant();
    tenant.clearEvents();
    tenantRepo.findById.mockResolvedValue(tenant);

    const result = await useCase.execute({
      tenantId: tenant.id.toValue(),
      provider: 'D360',
      whatsappNumber: '5511999999999',
      d360ApiKey: 'd360-api-key',
      d360WebhookUrl: 'https://app.atendeai.com/api/v1/webhooks/whatsapp',
    });

    expect(dialog360ManagementAcl.configurePhoneWebhook).toHaveBeenCalledWith({
      apiKey: 'd360-api-key',
      url: 'https://app.atendeai.com/api/v1/webhooks/whatsapp',
      tenantId: tenant.id.toValue(),
    });
    expect(result).toEqual(
      expect.objectContaining({
        provider: 'D360',
        whatsappNumber: '5511999999999',
        status: 'ACTIVE',
      }),
    );
    expect(tenant.whatsAppConfig?.provider).toBe('D360');
    expect(tenant.whatsAppConfig?.credentials).toEqual({
      apiKey: 'd360-api-key',
      baseUrl: 'https://waba-v2.360dialog.io',
    });
  });
});
