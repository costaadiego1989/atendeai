import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { AppModule } from '../../../app.module';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { IProcessInboundMessageUseCase } from '../application/use-cases/interfaces/IProcessInboundMessageUseCase';
import { GlobalExceptionFilter } from '@shared/infrastructure/http/filters/GlobalExceptionFilter';
import * as bcrypt from 'bcryptjs';
import * as cookieParser from 'cookie-parser';
import * as request from 'supertest';

describe('Messaging conversation intelligence (e2e)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let prisma: PrismaService;
  let processInboundMessageUseCase: IProcessInboundMessageUseCase;
  let tenantId: string;
  let authCookies: string[];

  const seed = Date.now();
  const ownerEmail = `messaging-intelligence-${seed}@test.com`;
  const password = 'SenhaForte123!';

  async function login() {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: ownerEmail, password })
      .expect(200);

    const cookies = response.get('Set-Cookie');
    expect(cookies).toBeDefined();
    return cookies!;
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
    processInboundMessageUseCase = app.get<IProcessInboundMessageUseCase>(
      IProcessInboundMessageUseCase,
    );

    const passwordHash = await bcrypt.hash(password, 10);
    const tenant = await prisma.tenant.create({
      data: {
        companyName: 'Messaging Intelligence Store',
        cnpj: `mi${String(seed).slice(-12)}`,
        plan: 'ESSENCIAL',
      },
    });
    tenantId = tenant.id;

    await prisma.user.create({
      data: {
        tenantId,
        name: 'Messaging Intelligence Owner',
        email: ownerEmail,
        phone: '11970000001',
        passwordHash,
        role: 'OWNER',
      },
    });

    authCookies = await login();
  });

  afterAll(async () => {
    if (prisma && tenantId) {
      await prisma
        .$executeRaw(
          Prisma.sql`
          DELETE FROM messaging_schema.conversation_intelligence
          WHERE tenant_id = ${tenantId}::uuid
        `,
        )
        .catch(() => {});
      await prisma.message
        .deleteMany({ where: { conversation: { tenantId } } })
        .catch(() => {});
      await prisma.conversation
        .deleteMany({ where: { tenantId } })
        .catch(() => {});
      await prisma.contact.deleteMany({ where: { tenantId } }).catch(() => {});
      await prisma.user.deleteMany({ where: { tenantId } }).catch(() => {});
      await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {});
    }

    if (app) {
      await app.close();
    }
  });

  it('should classify inbound conversation context and expose it in the conversations API', async () => {
    const externalMessageId = `intel-inbound-${Date.now()}`;

    await processInboundMessageUseCase.execute({
      tenantId,
      externalMessageId,
      fromPhone: '5511997000101',
      toPhone: '5511997000000',
      contentType: 'text',
      content: {
        text: 'Oi, quero comprar um produto, saber o valor e pagar no pix',
      },
      channel: 'WHATSAPP',
    });

    const conversation = await prisma.conversation.findFirstOrThrow({
      where: {
        tenantId,
        messages: {
          some: {
            externalId: externalMessageId,
          },
        },
      },
    });

    const listResponse = await request(app.getHttpServer())
      .get(
        `/api/v1/tenants/${tenantId}/conversations?page=1&limit=20&status=ACTIVE`,
      )
      .set('Cookie', authCookies)
      .expect(200);

    expect(listResponse.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: conversation.id,
          intelligence: expect.objectContaining({
            summary: expect.stringContaining('Cliente: Oi, quero comprar'),
            sentiment: 'POSITIVE',
            tags: expect.arrayContaining(['financeiro', 'venda']),
            interests: expect.arrayContaining(['preço', 'produto']),
            nextStep: expect.stringContaining('Enviar cobrança'),
          }),
        }),
      ]),
    );
  });

  it('should refresh intelligence when a human operator replies', async () => {
    const contact = await prisma.contact.create({
      data: {
        tenantId,
        name: 'Cliente Handoff',
        phone: '5511997000202',
        stage: 'LEAD',
      },
    });
    const conversation = await prisma.conversation.create({
      data: {
        tenantId,
        contactId: contact.id,
        channel: 'WHATSAPP',
        status: 'PENDING_HUMAN',
      },
    });

    await request(app.getHttpServer())
      .post(
        `/api/v1/tenants/${tenantId}/conversations/${conversation.id}/messages`,
      )
      .set('Cookie', authCookies)
      .send({
        content: {
          type: 'TEXT',
          text: 'Vou confirmar o frete, endereço de entrega, valor e pagamento no pix.',
        },
      })
      .expect(201);

    const listResponse = await request(app.getHttpServer())
      .get(
        `/api/v1/tenants/${tenantId}/conversations?page=1&limit=20&status=PENDING_HUMAN`,
      )
      .set('Cookie', authCookies)
      .expect(200);

    expect(listResponse.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: conversation.id,
          status: 'PENDING_HUMAN',
          intelligence: expect.objectContaining({
            summary: expect.stringContaining('Operador: Vou confirmar'),
            tags: expect.arrayContaining(['financeiro', 'checkout']),
            interests: expect.arrayContaining(['preço', 'entrega']),
          }),
        }),
      ]),
    );
  });
});
