import { Tenant } from '../domain/entities/Tenant';
import { User } from '../domain/entities/User';
import { CompanyName } from '../domain/value-objects/CompanyName';
import { CNPJ } from '../domain/value-objects/CNPJ';
import { Plan } from '../domain/value-objects/Plan';
import { Email } from '../domain/value-objects/Email';
import { Phone } from '../domain/value-objects/Phone';
import { Role } from '../domain/value-objects/Role';
import { UniqueEntityID } from '@shared/domain/UniqueEntityID';
import { WhatsAppConfig } from '../domain/entities/WhatsAppConfig';
import { InstagramConfig } from '../domain/entities/InstagramConfig';
import { AIConfig } from '../domain/entities/AIConfig';

describe('Tenant Entity', () => {
  function makeUser(role: 'OWNER' | 'ADMIN' = 'OWNER', id?: string) {
    return User.create(
      {
        name: 'John Doe',
        email: Email.create('john@example.com'),
        phone: Phone.create('11999998888'),
        passwordHash: 'hash',
        role: Role.create(role),
      },
      id ? new UniqueEntityID(id) : undefined,
    );
  }

  function makeTenant(props: any = {}) {
    const owner = makeUser('OWNER', 'owner-1');
    return Tenant.create({
      companyName: CompanyName.create('Acme Corp'),
      cnpj: CNPJ.create('12.345.678/0001-95'),
      plan: Plan.create('ESSENCIAL'),
      users: [owner],
      ...props,
    });
  }

  it('should create a valid tenant and generate TenantCreated event', () => {
    const tenant = makeTenant({ ownerPassword: 'password123' });

    expect(tenant.companyName.value).toBe('Acme Corp');
    expect(tenant.plan.value).toBe('ESSENCIAL');
    expect(tenant.planStatus).toBe('ACTIVE');
    expect(tenant.ownerUserId).toBe('owner-1');
    expect(tenant.apiKey).toBeDefined();

    const events = tenant.domainEvents;
    expect(events).toHaveLength(1);
    expect(events[0].constructor.name).toBe('TenantCreated');
    // @ts-ignore
    expect(events[0].ownerPassword).toBe('password123');
  });

  it('should set status to TRIALING if isTrial is true', () => {
    const tenant = makeTenant({ isTrial: true });
    expect(tenant.planStatus).toBe('TRIALING');
  });

  it('should reconstitute a tenant without generating events', () => {
    const id = new UniqueEntityID('tenant-1');
    const tenant = Tenant.reconstitute(
      {
        companyName: CompanyName.create('Old Corp'),
        cnpj: CNPJ.create('12345678000195'),
        plan: Plan.create('PROFISSIONAL'),
        planStatus: 'ACTIVE',
        ownerUserId: 'owner-1',
        users: [makeUser('OWNER', 'owner-1')],
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
      },
      id,
    );

    expect(tenant.id.equals(id)).toBe(true);
    expect(tenant.domainEvents).toHaveLength(0);
  });

  it('should change plan and generate TenantPlanChanged event', () => {
    const tenant = makeTenant();
    tenant.clearEvents();

    const newPlan = Plan.create('ESCALA');
    tenant.changePlan(newPlan, 'ACTIVE');

    expect(tenant.plan.value).toBe('ESCALA');
    expect(tenant.domainEvents).toHaveLength(1);
    expect(tenant.domainEvents[0].constructor.name).toBe('TenantPlanChanged');
    // @ts-ignore
    expect(tenant.domainEvents[0].newPlan).toBe('ESCALA');
  });

  it('should configure WhatsApp and generate WhatsAppConfigured event', () => {
    const tenant = makeTenant();
    tenant.clearEvents();

    const config = WhatsAppConfig.create({
      provider: 'BUBBLEWHATS',
      credentials: { id: '123', token: 'token', apiUrl: 'https://api.test' },
      whatsappNumber: '5511999998888',
      webhookSecret: null,
    });

    tenant.configureWhatsApp(config);

    expect(tenant.whatsAppConfig).toBe(config);
    expect(tenant.domainEvents).toHaveLength(1);
    expect(tenant.domainEvents[0].constructor.name).toBe('WhatsAppConfigured');
  });

  it('should configure Instagram and generate InstagramConfigured event', () => {
    const tenant = makeTenant();
    tenant.clearEvents();

    const config = InstagramConfig.create({
      metaAccessToken: 'token',
      instagramAccountId: 'ig-123',
      webhookSecret: 'secret',
    });

    tenant.configureInstagram(config);

    expect(tenant.instagramConfig).toBe(config);
    expect(tenant.domainEvents).toHaveLength(1);
    expect(tenant.domainEvents[0].constructor.name).toBe('InstagramConfigured');
  });

  it('should configure AI and generate AIConfigUpdated event', () => {
    const tenant = makeTenant();
    tenant.clearEvents();

    const config = AIConfig.create({
      systemPrompt: 'System prompt grande o suficiente',
      tone: 'FRIENDLY',
      language: 'pt-BR',
      maxTokensPerResponse: 100,
      confidenceThreshold: 0.7,
      escalationMessage: 'Escalation',
      businessRules: [],
    });

    tenant.configureAI(config);

    expect(tenant.aiConfig).toBe(config);
    expect(tenant.domainEvents).toHaveLength(1);
    expect(tenant.domainEvents[0].constructor.name).toBe('AIConfigUpdated');
  });

  it('should resolve owner correctly', () => {
    const owner = makeUser('OWNER', 'owner-1');
    const admin = makeUser('ADMIN', 'admin-1');
    const tenant = Tenant.create({
      companyName: CompanyName.create('Acme'),
      cnpj: CNPJ.create('12345678000195'),
      plan: Plan.create('ESSENCIAL'),
      users: [admin, owner],
    });

    expect(tenant.ownerUserId).toBe('owner-1');
    expect(tenant.owner?.id.toValue()).toBe('owner-1');
  });
});
