import { TenantDomainEventPublisher } from '../application/services/TenantDomainEventPublisher';
import { IEventBus } from '@shared/application/ports/IEventBus';
import { Tenant } from '../domain/entities/Tenant';
import { CompanyName } from '../domain/value-objects/CompanyName';
import { CNPJ } from '../domain/value-objects/CNPJ';
import { Plan } from '../domain/value-objects/Plan';
import { User } from '../domain/entities/User';
import { Email } from '../domain/value-objects/Email';
import { Phone } from '../domain/value-objects/Phone';
import { Role } from '../domain/value-objects/Role';
import { WhatsAppConfig } from '../domain/entities/WhatsAppConfig';
import { InstagramConfig } from '../domain/entities/InstagramConfig';
import { AIConfig } from '../domain/entities/AIConfig';
import { DomainEvent } from '@shared/domain/DomainEvent';

describe('TenantDomainEventPublisher', () => {
  let publisher: TenantDomainEventPublisher;
  let eventBus: jest.Mocked<IEventBus>;

  beforeEach(() => {
    eventBus = {
      publish: jest.fn(),
      subscribe: jest.fn(),
    };

    publisher = new TenantDomainEventPublisher(eventBus);
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

  it('should publish mapped integration events and clear domain events', async () => {
    const tenant = makeTenant();
    const whatsAppConfig = WhatsAppConfig.create({
      provider: 'BUBBLEWHATS',
      credentials: {
        id: '7071',
        token: 'tenant-token',
        apiUrl: 'https://7071.bubblewhats.com',
      },
      whatsappNumber: '5511999999999',
      webhookSecret: 'secret',
    });

    tenant.configureWhatsApp(whatsAppConfig);
    tenant.configureInstagram(
      InstagramConfig.create({
        metaAccessToken: 'meta-platform-token',
        instagramAccountId: '17841400000000000',
        webhookSecret: 'meta-platform-secret',
      }),
    );
    tenant.configureAI(
      AIConfig.create({
        systemPrompt: 'Prompt grande o suficiente',
        tone: 'FRIENDLY',
        language: 'pt-BR',
        maxTokensPerResponse: 500,
        confidenceThreshold: 0.7,
        escalationMessage: null,
        businessRules: [],
      }),
    );
    tenant.changePlan(Plan.create('PROFISSIONAL'));

    await publisher.publishFromAggregate(tenant);

    expect(eventBus.publish).toHaveBeenCalledTimes(5);
    expect(eventBus.publish.mock.calls.map((call) => call[0].queue)).toEqual([
      'tenant.created',
      'tenant.whatsapp-configured',
      'tenant.instagram-configured',
      'tenant.ai-config-updated',
      'tenant.plan-changed',
    ]);
    expect(tenant.domainEvents).toHaveLength(0);
  });

  it('should ignore unknown domain events and still clear them', async () => {
    const tenant = makeTenant();
    tenant.clearEvents();

    class UnknownTenantEvent extends DomainEvent {
      constructor(aggregateId: any) {
        super(aggregateId);
      }
    }

    (tenant as any)._domainEvents = [new UnknownTenantEvent(tenant.id)];

    await publisher.publishFromAggregate(tenant);

    expect(eventBus.publish).not.toHaveBeenCalled();
    expect(tenant.domainEvents).toHaveLength(0);
  });
});
