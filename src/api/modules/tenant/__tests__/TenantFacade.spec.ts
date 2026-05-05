import { TenantFacade } from '../application/facades/TenantFacade';
import { ITenantRepository } from '../domain/repositories/ITenantRepository';
import { Tenant } from '../domain/entities/Tenant';
import { CompanyName } from '../domain/value-objects/CompanyName';
import { CNPJ } from '../domain/value-objects/CNPJ';
import { Plan } from '../domain/value-objects/Plan';
import { User } from '../domain/entities/User';
import { Email } from '../domain/value-objects/Email';
import { Phone } from '../domain/value-objects/Phone';
import { Role } from '../domain/value-objects/Role';
import { InstagramConfig as TenantInstagramConfig } from '../domain/entities/InstagramConfig';
import { WhatsAppConfig as TenantWhatsAppConfig } from '../domain/entities/WhatsAppConfig';
import { TenantBranch } from '../domain/entities/TenantBranch';
import { UniqueEntityID } from '../../../shared/domain/UniqueEntityID';
import { Address } from '../domain/value-objects/Address';

describe('TenantFacade', () => {
  let facade: TenantFacade;
  let tenantRepository: jest.Mocked<ITenantRepository>;

  beforeEach(() => {
    tenantRepository = {
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

    facade = new TenantFacade(tenantRepository);
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

  it('should return persisted instagram credentials from the tenant aggregate', async () => {
    const tenant = makeTenant();
    tenant.clearEvents();
    tenant.configureInstagram(
      TenantInstagramConfig.create({
        metaAccessToken: 'persisted-meta-token',
        instagramAccountId: '17841400000000000',
        webhookSecret: 'persisted-webhook-secret',
      }),
    );
    tenantRepository.findById.mockResolvedValue(tenant);

    const config = await facade.getInstagramConfig(tenant.id.toValue());

    expect(config).toEqual({
      provider: 'META_GRAPH',
      credentials: {
        accessToken: 'persisted-meta-token',
      },
      instagramAccountId: '17841400000000000',
      webhookSecret: 'persisted-webhook-secret',
      status: 'PENDING_VERIFICATION',
    });
  });

  it('should merge branch whatsapp number into Twilio senderId for branch scoped outbound', async () => {
    const tenant = makeTenant();
    tenant.clearEvents();
    tenant.configureWhatsApp(
      TenantWhatsAppConfig.reconstitute(
        {
          provider: 'TWILIO',
          credentials: {
            senderId: 'whatsapp:+5511999990000',
          },
          whatsappNumber: '5511999990000',
          webhookSecret: 'twilio-secret',
          status: 'ACTIVE',
          configuredAt: new Date('2026-04-09T10:00:00.000Z'),
        },
        new UniqueEntityID('whatsapp-config-1'),
      ),
    );

    tenantRepository.findById.mockResolvedValue(tenant);
    tenantRepository.listBranches.mockResolvedValue([
      TenantBranch.create(
        {
          tenantId: tenant.id.toValue(),
          name: 'Loja Centro',
          phone: '21993001883',
          email: 'centro@acme.com',
          whatsappNumber: '5521993001883',
          instagramAccountId: null,
          cnpj: null,
          operatingHours: null,
          whatsAppConfigOverride: null,
          address: Address.create({
            zipcode: '20000-000',
            street: 'Rua A',
            streetNumber: '10',
            neighborhood: 'Centro',
            city: 'Rio de Janeiro',
            state: 'RJ',
          }),
          isHeadquarters: false,
          active: true,
        },
        new UniqueEntityID('branch-1'),
      ),
    ]);

    const config = await facade.getChannelConfig(
      tenant.id.toValue(),
      'WHATSAPP',
      'branch-1',
    );

    expect(config).toEqual({
      channel: 'WHATSAPP',
      provider: 'TWILIO',
      credentials: {
        senderId: 'whatsapp:+5521993001883',
      },
      webhookSecret: 'twilio-secret',
      externalAccountId: '5521993001883',
      status: 'ACTIVE',
      branchId: 'branch-1',
    });
  });

  it('should return branch override credentials when branch has its own whatsapp provider config', async () => {
    const tenant = makeTenant();
    tenant.clearEvents();
    tenant.configureWhatsApp(
      TenantWhatsAppConfig.reconstitute(
        {
          provider: 'BUBBLEWHATS',
          credentials: {
            id: 'global-id',
            token: 'global-token',
            apiUrl: 'https://global.example.com',
          },
          whatsappNumber: '5511999990000',
          webhookSecret: 'global-secret',
          status: 'ACTIVE',
          configuredAt: new Date('2026-04-09T10:00:00.000Z'),
        },
        new UniqueEntityID('whatsapp-config-2'),
      ),
    );

    const branch = TenantBranch.create(
      {
        tenantId: tenant.id.toValue(),
        name: 'Loja Barra',
        phone: '21993001883',
        email: 'barra@acme.com',
        whatsappNumber: '5521993001883',
        instagramAccountId: null,
        cnpj: null,
        operatingHours: null,
        whatsAppConfigOverride: {
          provider: 'D360',
          credentials: {
            apiKey: 'branch-api-key',
            baseUrl: 'https://branch.example.com',
          },
          webhookSecret: 'branch-secret',
        },
        address: Address.create({
          zipcode: '20000-000',
          street: 'Rua B',
          streetNumber: '20',
          neighborhood: 'Barra',
          city: 'Rio de Janeiro',
          state: 'RJ',
        }),
        isHeadquarters: false,
        active: true,
      },
      new UniqueEntityID('branch-2'),
    );

    tenantRepository.findByWhatsAppNumber.mockResolvedValue(tenant);
    tenantRepository.findBranchByWhatsAppNumber = jest.fn().mockResolvedValue({
      tenantId: tenant.id.toValue(),
      branch,
    });

    const result = await facade.getWhatsAppConfigByNumber('5521993001883');

    expect(result).toEqual({
      tenantId: tenant.id.toValue(),
      branchId: 'branch-2',
      config: {
        provider: 'D360',
        credentials: {
          apiKey: 'branch-api-key',
          baseUrl: 'https://branch.example.com',
        },
        webhookSecret: 'branch-secret',
        whatsappNumber: '5521993001883',
        status: 'ACTIVE',
        branchId: 'branch-2',
      },
    });
  });
});
