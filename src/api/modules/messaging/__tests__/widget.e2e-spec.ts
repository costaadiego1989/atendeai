import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../../app.module';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { createHash } from 'crypto';
import { GlobalExceptionFilter } from '@shared/infrastructure/http/filters/GlobalExceptionFilter';

function widgetPhone(visitorId: string): string {
  return `wgt_${createHash('sha256').update(visitorId).digest('hex').slice(0, 15)}`;
}

describe('Widget (e2e)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let prisma: PrismaService;
  let tenantId: string;
  let otherTenantId: string;
  let publicToken: string;
  let otherPublicToken: string;
  let sessionId: string;

  const tenantCnpj = `w${Date.now()}`.slice(-14);
  const otherTenantCnpj = `x${Date.now() + 1}`.slice(-14);

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

    // Create tenant A with widget config
    const tenant = await prisma.tenant.create({
      data: { companyName: 'Widget E2E Store', cnpj: tenantCnpj, plan: 'ESSENCIAL' },
    });
    tenantId = tenant.id;

    const widgetConfig = await prisma.widgetConfig.create({
      data: {
        tenantId,
        enabled: true,
        name: 'E2E Widget',
        greeting: 'Olá! Bem-vindo.',
        color: '#007bff',
        position: 'bottom-right',
        collectName: true,
        collectPhone: false,
        proactiveDelay: 5000,
        proactiveMsg: 'Precisa de ajuda?',
      },
    });
    publicToken = widgetConfig.publicToken;

    // Create tenant B with widget config (for isolation)
    const otherTenant = await prisma.tenant.create({
      data: { companyName: 'Other Widget Store', cnpj: otherTenantCnpj, plan: 'ESSENCIAL' },
    });
    otherTenantId = otherTenant.id;

    const otherWidgetConfig = await prisma.widgetConfig.create({
      data: {
        tenantId: otherTenantId,
        enabled: true,
        name: 'Other Widget',
        greeting: 'Hi!',
        color: '#ff0000',
        position: 'bottom-left',
        collectName: false,
        collectPhone: false,
      },
    });
    otherPublicToken = otherWidgetConfig.publicToken;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.message.deleteMany({ where: { conversation: { tenantId: { in: [tenantId, otherTenantId] } } } }).catch(() => {});
    await prisma.conversation.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId] } } }).catch(() => {});
    await prisma.widgetSession.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId] } } }).catch(() => {});
    await prisma.contact.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId] } } }).catch(() => {});
    await prisma.widgetConfig.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId] } } }).catch(() => {});
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantId, otherTenantId] } } }).catch(() => {});
    await app.close();
  });

  describe('GET /api/v1/widget/:publicToken/config', () => {
    it('should return widget configuration', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/widget/${publicToken}/config`)
        .expect(200);

      expect(response.body.name).toBe('E2E Widget');
      expect(response.body.greeting).toBe('Olá! Bem-vindo.');
      expect(response.body.color).toBe('#007bff');
    });

    it('should return 404 for invalid token', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/widget/00000000-0000-0000-0000-000000000099/config')
        .expect(404);
    });
  });

  describe('POST /api/v1/widget/:publicToken/sessions', () => {
    it('should create a new session', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/widget/${publicToken}/sessions`)
        .send({
          visitorId: 'visitor-e2e-1',
          visitorName: 'E2E Visitor',
          pageUrl: 'https://example.com/pricing',
        })
        .expect(201);

      expect(response.body.sessionId).toBeDefined();
      expect(response.body.resumed).toBe(false);
      sessionId = response.body.sessionId;
    });

    it('should resume existing session', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/widget/${publicToken}/sessions`)
        .send({
          visitorId: 'visitor-e2e-1',
          visitorName: 'E2E Visitor Updated',
        })
        .expect(201);

      expect(response.body.sessionId).toBe(sessionId);
      expect(response.body.resumed).toBe(true);
    });

    it('should return 400 when visitorId is missing', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/widget/${publicToken}/sessions`)
        .send({ visitorName: 'No ID' })
        .expect(400);
    });
  });

  describe('POST /api/v1/widget/:publicToken/messages', () => {
    it('should send a message and create conversation', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/widget/${publicToken}/messages`)
        .send({
          sessionId,
          visitorId: 'visitor-e2e-1',
          text: 'Olá, preciso de ajuda!',
        })
        .expect(201);

      expect(response.body.messageId).toBeDefined();
      expect(response.body.conversationId).toBeDefined();
      expect(response.body.contactId).toBeDefined();
    });

    it('should return 400 when text is missing', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/widget/${publicToken}/messages`)
        .send({ sessionId, visitorId: 'visitor-e2e-1' })
        .expect(400);
    });
  });

  describe('GET /api/v1/widget/:publicToken/sessions/:sessionId/messages', () => {
    it('should return message history', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/widget/${publicToken}/sessions/${sessionId}/messages`)
        .expect(200);

      expect(response.body.messages).toBeDefined();
      expect(response.body.messages.length).toBeGreaterThanOrEqual(1);
      expect(response.body.messages[0].content).toEqual(
        expect.objectContaining({ text: 'Olá, preciso de ajuda!' }),
      );
    });
  });

  describe('Tenant Isolation', () => {
    it('should not access session from another tenant widget', async () => {
      // Try to get messages using other tenant's token but first tenant's session
      const response = await request(app.getHttpServer())
        .get(`/api/v1/widget/${otherPublicToken}/sessions/${sessionId}/messages`)
        .expect(200);

      // Should return empty (session belongs to different tenant)
      expect(response.body.messages).toEqual([]);
    });

    it('should not send message to session via wrong tenant widget', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/widget/${otherPublicToken}/messages`)
        .send({
          sessionId,
          visitorId: 'visitor-e2e-1',
          text: 'Cross-tenant attempt',
        })
        .expect(404);
    });
  });

  describe('Contact Creation (REQ-W02)', () => {
    it('should create a contact in DB after session init', async () => {
      const visitorId = `contact-check-${Date.now()}`;

      const res = await request(app.getHttpServer())
        .post(`/api/v1/widget/${publicToken}/sessions`)
        .send({ visitorId, visitorName: 'Contact Test Visitor' })
        .expect(201);

      expect(res.body.sessionId).toBeDefined();

      const contact = await prisma.contact.findFirst({
        where: {
          tenantId,
          phone: widgetPhone(visitorId),
        },
      });

      expect(contact).not.toBeNull();
      expect(contact!.name).toBe('Contact Test Visitor');
    });

    it('should reuse existing contact on session resume', async () => {
      const visitorId = `contact-reuse-${Date.now()}`;

      await request(app.getHttpServer())
        .post(`/api/v1/widget/${publicToken}/sessions`)
        .send({ visitorId, visitorName: 'Reuse Visitor' })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/v1/widget/${publicToken}/sessions`)
        .send({ visitorId, visitorName: 'Reuse Visitor Updated' })
        .expect(201);

      const contacts = await prisma.contact.findMany({
        where: { tenantId, phone: widgetPhone(visitorId) },
      });

      expect(contacts.length).toBe(1);
    });
  });

  describe('Session Restart — DELETE /sessions/:id (REQ-W05)', () => {
    let restartSessionId: string;
    let restartConversationId: string;

    beforeAll(async () => {
      const visitorId = `restart-visitor-${Date.now()}`;

      const sessRes = await request(app.getHttpServer())
        .post(`/api/v1/widget/${publicToken}/sessions`)
        .send({ visitorId, visitorName: 'Restart Visitor' })
        .expect(201);

      restartSessionId = sessRes.body.sessionId;

      await request(app.getHttpServer())
        .post(`/api/v1/widget/${publicToken}/messages`)
        .send({ sessionId: restartSessionId, visitorId, text: 'Hello before restart' })
        .expect(201);

      const updatedSession = await prisma.widgetSession.findUnique({
        where: { id: restartSessionId },
      });
      restartConversationId = updatedSession!.conversationId!;
    });

    it('should archive session and conversation on DELETE', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/widget/${publicToken}/sessions/${restartSessionId}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
        });

      const session = await prisma.widgetSession.findUnique({
        where: { id: restartSessionId },
      });
      expect(session!.status).toBe('CLOSED');

      const conversation = await prisma.conversation.findUnique({
        where: { id: restartConversationId },
      });
      expect(conversation!.status).toBe('ARCHIVED');
    });

    it('should allow new session after restart with same visitorId', async () => {
      const visitorId = `restart-visitor-new-${Date.now()}`;

      await request(app.getHttpServer())
        .post(`/api/v1/widget/${publicToken}/sessions`)
        .send({ visitorId, visitorName: 'Fresh Visitor' })
        .expect(201)
        .expect((res) => {
          expect(res.body.resumed).toBe(false);
          expect(res.body.sessionId).toBeDefined();
        });
    });

    it('should return 404 when deleting session from another tenant', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/widget/${otherPublicToken}/sessions/${restartSessionId}`)
        .expect(404);
    });

    it('should return 404 for non-existent session', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await request(app.getHttpServer())
        .delete(`/api/v1/widget/${publicToken}/sessions/${fakeId}`)
        .expect(404);
    });
  });

  describe('AI Message Visibility (REQ-W04)', () => {
    it('should return outbound AI messages in GET session messages', async () => {
      const visitorId = `ai-msg-visitor-${Date.now()}`;

      const sessRes = await request(app.getHttpServer())
        .post(`/api/v1/widget/${publicToken}/sessions`)
        .send({ visitorId, visitorName: 'AI Test Visitor' })
        .expect(201);

      const aiSessionId = sessRes.body.sessionId;

      const sess = await prisma.widgetSession.findUnique({
        where: { id: aiSessionId },
      });
      const convId = sess!.conversationId;
      expect(convId).toBeDefined();

      // Seed an AI reply directly (simulates what ProcessAIResponseUseCase would save)
      await prisma.message.create({
        data: {
          conversationId: convId!,
          direction: 'OUTBOUND',
          contentType: 'TEXT',
          content: { text: 'Olá! Posso ajudar com algo?' } as any,
          sentBy: 'AI',
          deliveryStatus: 'DELIVERED',
        },
      });

      const msgRes = await request(app.getHttpServer())
        .get(`/api/v1/widget/${publicToken}/sessions/${aiSessionId}/messages`)
        .expect(200);

      const outbound = msgRes.body.messages.filter(
        (m: any) => m.direction === 'OUTBOUND',
      );
      expect(outbound.length).toBeGreaterThanOrEqual(1);
      expect(outbound[0].content.text).toBe('Olá! Posso ajudar com algo?');
      expect(outbound[0].sentBy).toBe('AI');
    });
  });

  describe('Session History on Resume (REQ-W01)', () => {
    it('should load message history when session is resumed', async () => {
      const visitorId = `history-visitor-${Date.now()}`;

      const sessRes = await request(app.getHttpServer())
        .post(`/api/v1/widget/${publicToken}/sessions`)
        .send({ visitorId, visitorName: 'History Visitor' })
        .expect(201);

      const histSessionId = sessRes.body.sessionId;

      await request(app.getHttpServer())
        .post(`/api/v1/widget/${publicToken}/messages`)
        .send({ sessionId: histSessionId, visitorId, text: 'Mensagem para histórico' })
        .expect(201);

      // Resume same visitorId (simulates page reload)
      const resumeRes = await request(app.getHttpServer())
        .post(`/api/v1/widget/${publicToken}/sessions`)
        .send({ visitorId, visitorName: 'History Visitor' })
        .expect(201);

      expect(resumeRes.body.resumed).toBe(true);
      expect(resumeRes.body.sessionId).toBe(histSessionId);

      const msgRes = await request(app.getHttpServer())
        .get(`/api/v1/widget/${publicToken}/sessions/${histSessionId}/messages`)
        .expect(200);

      expect(msgRes.body.messages.length).toBeGreaterThanOrEqual(1);
      expect(
        msgRes.body.messages.some(
          (m: any) => m.content?.text === 'Mensagem para histórico',
        ),
      ).toBe(true);
    });
  });

  // ─── Contact (user) creation — DB verification ──────────────────────────────

  describe('Contact (user) creation — DB verification', () => {
    it('creates contact in DB with visitorName as name', async () => {
      const visitorId = `db-contact-name-${Date.now()}`;

      await request(app.getHttpServer())
        .post(`/api/v1/widget/${publicToken}/sessions`)
        .send({ visitorId, visitorName: 'João da Silva' })
        .expect(201);

      const contact = await prisma.contact.findFirst({
        where: { tenantId, phone: widgetPhone(visitorId) },
      });

      expect(contact).not.toBeNull();
      expect(contact!.name).toBe('João da Silva');
    });

    it('creates contact with real phone when visitorPhone provided', async () => {
      const visitorId = `db-contact-phone-${Date.now()}`;

      await request(app.getHttpServer())
        .post(`/api/v1/widget/${publicToken}/sessions`)
        .send({ visitorId, visitorName: 'Fone Test', visitorPhone: '21999990001' })
        .expect(201);

      const contact = await prisma.contact.findFirst({
        where: { tenantId, phone: '21999990001' },
      });

      expect(contact).not.toBeNull();
      expect(contact!.name).toBe('Fone Test');
    });

    it('falls back to wgt_hash phone when no visitorPhone provided', async () => {
      const visitorId = `db-contact-hash-${Date.now()}`;
      const expectedPhone = widgetPhone(visitorId);

      await request(app.getHttpServer())
        .post(`/api/v1/widget/${publicToken}/sessions`)
        .send({ visitorId, visitorName: 'Hash Phone Test' })
        .expect(201);

      const contact = await prisma.contact.findFirst({
        where: { tenantId, phone: expectedPhone },
      });

      expect(contact).not.toBeNull();
      expect(contact!.phone).toBe(expectedPhone);
    });

    it('stores email on contact when visitorEmail provided', async () => {
      const visitorId = `db-contact-email-${Date.now()}`;

      await request(app.getHttpServer())
        .post(`/api/v1/widget/${publicToken}/sessions`)
        .send({
          visitorId,
          visitorName: 'Email Test',
          visitorEmail: 'widget-test@example.com',
        })
        .expect(201);

      const contact = await prisma.contact.findFirst({
        where: { tenantId, email: 'widget-test@example.com' },
      });

      expect(contact).not.toBeNull();
      expect(contact!.email).toBe('widget-test@example.com');
    });

    it('creates contact with stage LEAD', async () => {
      const visitorId = `db-contact-stage-${Date.now()}`;

      await request(app.getHttpServer())
        .post(`/api/v1/widget/${publicToken}/sessions`)
        .send({ visitorId, visitorName: 'Stage Test' })
        .expect(201);

      const contact = await prisma.contact.findFirst({
        where: { tenantId, phone: widgetPhone(visitorId) },
      });

      expect(contact).not.toBeNull();
      expect(contact!.stage).toBe('LEAD');
    });

    it('creates conversation immediately on session init — conversationId in response', async () => {
      const visitorId = `db-conv-immediate-${Date.now()}`;

      const res = await request(app.getHttpServer())
        .post(`/api/v1/widget/${publicToken}/sessions`)
        .send({ visitorId, visitorName: 'Conv Immediate' })
        .expect(201);

      expect(res.body.conversationId).toBeTruthy();

      const conv = await prisma.conversation.findUnique({
        where: { id: res.body.conversationId },
      });

      expect(conv).not.toBeNull();
      expect(conv!.channel).toBe('WEB_CHAT');
      expect(conv!.tenantId).toBe(tenantId);
    });

    it('does NOT create duplicate contact on session resume', async () => {
      const visitorId = `db-no-dup-${Date.now()}`;

      await request(app.getHttpServer())
        .post(`/api/v1/widget/${publicToken}/sessions`)
        .send({ visitorId, visitorName: 'First Visit' })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/v1/widget/${publicToken}/sessions`)
        .send({ visitorId, visitorName: 'Second Visit' })
        .expect(201);

      const contacts = await prisma.contact.findMany({
        where: { tenantId, phone: widgetPhone(visitorId) },
      });

      expect(contacts.length).toBe(1);
    });

    it('widgetSession.contactId and conversationId populated after init', async () => {
      const visitorId = `db-session-refs-${Date.now()}`;

      const sessRes = await request(app.getHttpServer())
        .post(`/api/v1/widget/${publicToken}/sessions`)
        .send({ visitorId, visitorName: 'Refs Test' })
        .expect(201);

      const session = await prisma.widgetSession.findUnique({
        where: { id: sessRes.body.sessionId },
      });

      expect(session).not.toBeNull();
      expect(session!.contactId).not.toBeNull();
      expect(session!.conversationId).not.toBeNull();
      expect(session!.conversationId).toBe(sessRes.body.conversationId);
    });
  });

  // ─── Message creation — DB verification ─────────────────────────────────────

  describe('Message creation — DB verification', () => {
    let msgSessionId: string;
    let msgVisitorId: string;

    beforeAll(async () => {
      msgVisitorId = `db-msg-visitor-${Date.now()}`;

      const sessRes = await request(app.getHttpServer())
        .post(`/api/v1/widget/${publicToken}/sessions`)
        .send({ visitorId: msgVisitorId, visitorName: 'Msg DB Visitor' })
        .expect(201);

      msgSessionId = sessRes.body.sessionId;
    });

    it('message saved to DB with direction INBOUND and sentBy CONTACT', async () => {
      const text = `Olá, quero saber mais! ${Date.now()}`;

      const res = await request(app.getHttpServer())
        .post(`/api/v1/widget/${publicToken}/messages`)
        .send({ sessionId: msgSessionId, visitorId: msgVisitorId, text })
        .expect(201);

      const message = await prisma.message.findUnique({
        where: { id: res.body.messageId },
      });

      expect(message).not.toBeNull();
      expect(message!.direction).toBe('INBOUND');
      expect(message!.sentBy).toBe('CONTACT');
      expect(message!.contentType).toBe('TEXT');
      expect((message!.content as any).text).toBe(text);
    });

    it('message content.text stored exactly as sent', async () => {
      const text = 'Texto exato com acentuação: ção üéà';

      const res = await request(app.getHttpServer())
        .post(`/api/v1/widget/${publicToken}/messages`)
        .send({ sessionId: msgSessionId, visitorId: msgVisitorId, text })
        .expect(201);

      const message = await prisma.message.findUnique({
        where: { id: res.body.messageId },
      });

      expect((message!.content as any).text).toBe(text);
    });

    it('conversation lastMessagePreview updated after message', async () => {
      const text = `Preview test message ${Date.now()}`;

      const res = await request(app.getHttpServer())
        .post(`/api/v1/widget/${publicToken}/messages`)
        .send({ sessionId: msgSessionId, visitorId: msgVisitorId, text })
        .expect(201);

      const conv = await prisma.conversation.findUnique({
        where: { id: res.body.conversationId },
      });

      expect(conv!.lastMessagePreview).toBe(text.substring(0, 100));
      expect(conv!.lastMessageDirection).toBe('INBOUND');
    });

    it('conversation unreadCount increments per message', async () => {
      const convRes = await request(app.getHttpServer())
        .post(`/api/v1/widget/${publicToken}/messages`)
        .send({ sessionId: msgSessionId, visitorId: msgVisitorId, text: 'First unread' })
        .expect(201);

      const convBefore = await prisma.conversation.findUnique({
        where: { id: convRes.body.conversationId },
      });
      const unreadBefore = convBefore!.unreadCount;

      await request(app.getHttpServer())
        .post(`/api/v1/widget/${publicToken}/messages`)
        .send({ sessionId: msgSessionId, visitorId: msgVisitorId, text: 'Second unread' })
        .expect(201);

      const convAfter = await prisma.conversation.findUnique({
        where: { id: convRes.body.conversationId },
      });

      expect(convAfter!.unreadCount).toBeGreaterThan(unreadBefore);
    });

    it('multiple messages go to same conversation (no duplicate created)', async () => {
      const visitorId = `db-msg-single-conv-${Date.now()}`;

      const sessRes = await request(app.getHttpServer())
        .post(`/api/v1/widget/${publicToken}/sessions`)
        .send({ visitorId, visitorName: 'Single Conv Visitor' })
        .expect(201);

      const sid = sessRes.body.sessionId;

      const msg1 = await request(app.getHttpServer())
        .post(`/api/v1/widget/${publicToken}/messages`)
        .send({ sessionId: sid, visitorId, text: 'First message' })
        .expect(201);

      const msg2 = await request(app.getHttpServer())
        .post(`/api/v1/widget/${publicToken}/messages`)
        .send({ sessionId: sid, visitorId, text: 'Second message' })
        .expect(201);

      expect(msg1.body.conversationId).toBe(msg2.body.conversationId);

      const conversations = await prisma.conversation.findMany({
        where: { tenantId, contactId: msg1.body.contactId, channel: 'WEB_CHAT' },
      });
      expect(conversations.length).toBe(1);
    });

    it('SYSTEM [WIDGET_INIT] message hidden from GET /sessions/:id/messages', async () => {
      const visitorId = `db-hidden-sys-${Date.now()}`;

      const sessRes = await request(app.getHttpServer())
        .post(`/api/v1/widget/${publicToken}/sessions`)
        .send({ visitorId, visitorName: 'Hidden System Visitor' })
        .expect(201);

      const sysSessionId = sessRes.body.sessionId;

      const msgRes = await request(app.getHttpServer())
        .get(`/api/v1/widget/${publicToken}/sessions/${sysSessionId}/messages`)
        .expect(200);

      const systemMessages = msgRes.body.messages.filter(
        (m: any) =>
          m.sentBy === 'SYSTEM' ||
          (typeof m.content?.text === 'string' &&
            m.content.text.includes('[WIDGET_INIT]')),
      );

      expect(systemMessages.length).toBe(0);
    });

    it('conversation created with channel WEB_CHAT', async () => {
      const visitorId = `db-msg-channel-${Date.now()}`;

      const sessRes = await request(app.getHttpServer())
        .post(`/api/v1/widget/${publicToken}/sessions`)
        .send({ visitorId, visitorName: 'Channel Test' })
        .expect(201);

      const sid = sessRes.body.sessionId;

      const msgRes = await request(app.getHttpServer())
        .post(`/api/v1/widget/${publicToken}/messages`)
        .send({ sessionId: sid, visitorId, text: 'Canal test' })
        .expect(201);

      const conv = await prisma.conversation.findUnique({
        where: { id: msgRes.body.conversationId },
      });

      expect(conv!.channel).toBe('WEB_CHAT');
    });

    it('message deliveryStatus is DELIVERED', async () => {
      const text = 'Status test message';

      const res = await request(app.getHttpServer())
        .post(`/api/v1/widget/${publicToken}/messages`)
        .send({ sessionId: msgSessionId, visitorId: msgVisitorId, text })
        .expect(201);

      const message = await prisma.message.findUnique({
        where: { id: res.body.messageId },
      });

      expect(message!.deliveryStatus).toBe('DELIVERED');
    });

    it('response includes contactId matching the created contact', async () => {
      const visitorId = `db-contact-match-${Date.now()}`;

      const sessRes = await request(app.getHttpServer())
        .post(`/api/v1/widget/${publicToken}/sessions`)
        .send({ visitorId, visitorName: 'Contact Match Test' })
        .expect(201);

      const sid = sessRes.body.sessionId;

      const msgRes = await request(app.getHttpServer())
        .post(`/api/v1/widget/${publicToken}/messages`)
        .send({ sessionId: sid, visitorId, text: 'Match contact' })
        .expect(201);

      const contact = await prisma.contact.findUnique({
        where: { id: msgRes.body.contactId },
      });

      expect(contact).not.toBeNull();
      expect(contact!.tenantId).toBe(tenantId);
      expect(contact!.phone).toBe(widgetPhone(visitorId));
    });
  });
});
