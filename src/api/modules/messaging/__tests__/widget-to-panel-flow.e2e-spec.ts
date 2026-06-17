import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../../app.module';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import * as bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { GlobalExceptionFilter } from '@shared/infrastructure/http/filters/GlobalExceptionFilter';

describe('Widget → Panel full flow (e2e)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let prisma: PrismaService;

  let tenantId: string;
  let otherTenantId: string;
  let publicToken: string;
  let operatorCookie: string;
  let otherOperatorCookie: string;

  let sessionId: string;
  let conversationId: string;
  let contactId: string;

  const visitorId = `flow-visitor-${Date.now()}`;
  const operatorEmail = `widget-flow-owner-${Date.now()}@test.com`;
  const otherOperatorEmail = `widget-flow-other-${Date.now()}@test.com`;
  const password = 'SenhaForte123!';
  const tenantCnpj = `wf${Date.now()}`.slice(-14);
  const otherTenantCnpj = `wo${Date.now() + 1}`.slice(-14);

  async function login(email: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);

    const cookies = response.get('Set-Cookie');
    expect(cookies).toBeDefined();
    return cookies![0];
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.setGlobalPrefix('api/v1');
    await app.init();

    prisma = app.get(PrismaService);

    const passwordHash = await bcrypt.hash(password, 10);

    const tenant = await prisma.tenant.create({
      data: {
        companyName: 'Widget Flow Store',
        cnpj: tenantCnpj,
        plan: 'ESSENCIAL',
      },
    });
    tenantId = tenant.id;

    const widgetConfig = await prisma.widgetConfig.create({
      data: {
        tenantId,
        enabled: true,
        name: 'Flow Widget',
        greeting: 'Olá! Como posso ajudar?',
        color: '#007bff',
        position: 'bottom-right',
        collectName: true,
        collectPhone: false,
      },
    });
    publicToken = widgetConfig.publicToken;

    await prisma.user.create({
      data: {
        tenantId,
        name: 'Flow Operator',
        email: operatorEmail,
        phone: '11970000001',
        passwordHash,
        role: 'OWNER',
      },
    });

    const otherTenant = await prisma.tenant.create({
      data: {
        companyName: 'Other Flow Store',
        cnpj: otherTenantCnpj,
        plan: 'ESSENCIAL',
      },
    });
    otherTenantId = otherTenant.id;

    await prisma.user.create({
      data: {
        tenantId: otherTenantId,
        name: 'Other Operator',
        email: otherOperatorEmail,
        phone: '11970000002',
        passwordHash,
        role: 'OWNER',
      },
    });

    operatorCookie = await login(operatorEmail);
    otherOperatorCookie = await login(otherOperatorEmail);
  });

  afterAll(async () => {
    if (!prisma) {
      return;
    }
    const ids = [tenantId, otherTenantId].filter(Boolean);
    await prisma.message
      .deleteMany({ where: { conversation: { tenantId: { in: ids } } } })
      .catch(() => {});
    await prisma.conversation
      .deleteMany({ where: { tenantId: { in: ids } } })
      .catch(() => {});
    await prisma.widgetSession
      .deleteMany({ where: { tenantId: { in: ids } } })
      .catch(() => {});
    await prisma.contact
      .deleteMany({ where: { tenantId: { in: ids } } })
      .catch(() => {});
    await prisma.widgetConfig
      .deleteMany({ where: { tenantId: { in: ids } } })
      .catch(() => {});
    await prisma.user
      .deleteMany({ where: { tenantId: { in: ids } } })
      .catch(() => {});
    await prisma.tenant
      .deleteMany({ where: { id: { in: ids } } })
      .catch(() => {});
    await app.close();
  });

  it('1. visitor opens the widget → LEAD contact + WEB_CHAT conversation created', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/widget/${publicToken}/sessions`)
      .send({ visitorId, visitorName: 'Maria Visitante' })
      .expect(201);

    expect(res.body.sessionId).toBeDefined();
    expect(res.body.conversationId).toBeTruthy();
    sessionId = res.body.sessionId;
    conversationId = res.body.conversationId;

    const conv = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    expect(conv).not.toBeNull();
    expect(conv!.channel).toBe('WEB_CHAT');
    expect(conv!.tenantId).toBe(tenantId);
  });

  it('2. visitor sends a message → INBOUND message persisted on the conversation', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/widget/${publicToken}/messages`)
      .send({
        sessionId,
        visitorId,
        text: 'Quero falar com um atendente, por favor.',
      })
      .expect(201);

    expect(res.body.messageId).toBeDefined();
    expect(res.body.conversationId).toBe(conversationId);
    expect(res.body.contactId).toBeDefined();
    contactId = res.body.contactId;

    const message = await prisma.message.findUnique({
      where: { id: res.body.messageId },
    });
    expect(message!.direction).toBe('INBOUND');
    expect(message!.sentBy).toBe('CONTACT');
    expect((message!.content as any).text).toBe(
      'Quero falar com um atendente, por favor.',
    );
  });

  it('3. operator sees the widget conversation in the messaging panel', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/conversations?status=ACTIVE`)
      .set('Cookie', [operatorCookie])
      .expect(200);

    const conv = res.body.data.find((c: any) => c.id === conversationId);
    expect(conv).toBeDefined();
    expect(conv.contactName).toBe('Maria Visitante');
  });

  it('4. operator reads the conversation → visitor message visible in the panel', async () => {
    const res = await request(app.getHttpServer())
      .get(
        `/api/v1/tenants/${tenantId}/conversations/${conversationId}/messages`,
      )
      .set('Cookie', [operatorCookie])
      .expect(200);

    const texts = res.body.data.map((m: any) => m.content?.text);
    expect(texts).toContain('Quero falar com um atendente, por favor.');
  });

  it('5. contact shows up in the CRM as a LEAD', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/contacts/${contactId}`)
      .set('Cookie', [operatorCookie])
      .expect(200);

    expect(res.body.id).toBe(contactId);
    expect(res.body.name).toBe('Maria Visitante');
    expect(res.body.stage).toBe('LEAD');
  });

  it('6. operator replies from the panel → OUTBOUND message persisted', async () => {
    await request(app.getHttpServer())
      .post(
        `/api/v1/tenants/${tenantId}/conversations/${conversationId}/messages`,
      )
      .set('Cookie', [operatorCookie])
      .send({
        content: { type: 'TEXT', text: 'Olá Maria! Sou a atendente, como ajudo?' },
      })
      .expect(201);

    const reply = await prisma.message.findFirst({
      where: { conversationId, direction: 'OUTBOUND', sentBy: 'HUMAN' },
      orderBy: { createdAt: 'desc' },
    });
    expect(reply).not.toBeNull();
    expect((reply!.content as any).text).toBe(
      'Olá Maria! Sou a atendente, como ajudo?',
    );
  });

  it('7. operator reply is delivered back to the visitor in the widget', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/widget/${publicToken}/sessions/${sessionId}/messages`)
      .expect(200);

    const outbound = res.body.messages.filter(
      (m: any) => m.direction === 'OUTBOUND',
    );
    expect(outbound.length).toBeGreaterThanOrEqual(1);
    expect(outbound.some((m: any) => m.sentBy === 'HUMAN')).toBe(true);
    expect(
      outbound.some(
        (m: any) => m.content?.text === 'Olá Maria! Sou a atendente, como ajudo?',
      ),
    ).toBe(true);
  });

  describe('8. tenant isolation', () => {
    it('another tenant operator cannot read the conversation via its own scope', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/tenants/${otherTenantId}/conversations?status=ACTIVE`)
        .set('Cookie', [otherOperatorCookie])
        .expect(200);

      expect(
        res.body.data.find((c: any) => c.id === conversationId),
      ).toBeUndefined();
    });

    it('another tenant operator is rejected when targeting tenant A directly', async () => {
      await request(app.getHttpServer())
        .get(
          `/api/v1/tenants/${tenantId}/conversations/${conversationId}/messages`,
        )
        .set('Cookie', [otherOperatorCookie])
        .expect(403);
    });

    it('another tenant operator cannot read tenant A contact', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/tenants/${tenantId}/contacts/${contactId}`)
        .set('Cookie', [otherOperatorCookie])
        .expect(403);
    });
  });
});