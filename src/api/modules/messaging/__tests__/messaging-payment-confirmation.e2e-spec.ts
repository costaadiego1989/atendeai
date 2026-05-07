import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../../app.module';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import * as bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { GlobalExceptionFilter } from '@shared/infrastructure/http/filters/GlobalExceptionFilter';

describe('Messaging Payment Confirmation Flow (e2e)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let prisma: PrismaService;
  let tenantId: string;
  let conversationId: string;
  let authCookie: string;
  let contactId: string;

  const ownerEmail = `payment-confirmation-owner-${Date.now()}@test.com`;
  const password = 'SenhaForte123!';
  const tenantCnpj = `mpc${Date.now()}`;

  async function login(email: string) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);

    return response.get('Set-Cookie')![0];
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

    await prisma.user.deleteMany({ where: { email: ownerEmail } }).catch(() => {});

    const passwordHash = await bcrypt.hash(password, 10);

    const tenant = await prisma.tenant.create({
      data: {
        companyName: 'Messaging Payment Confirmation Store',
        cnpj: tenantCnpj,
        plan: 'ESSENCIAL',
      },
    });
    tenantId = tenant.id;

    await prisma.user.create({
      data: {
        tenantId,
        name: 'Payment Confirmation Owner',
        email: ownerEmail,
        phone: '11960000101',
        passwordHash,
        role: 'OWNER',
      },
    });

    authCookie = await login(ownerEmail);

    const contact = await prisma.contact.create({
      data: {
        tenantId,
        name: 'Lead Payment Confirmation',
        phone: '551199995555',
        stage: 'LEAD',
      },
    });
    contactId = contact.id;

    const conversation = await prisma.conversation.create({
      data: {
        tenantId,
        contactId,
        channel: 'WHATSAPP',
        status: 'ACTIVE',
      },
    });
    conversationId = conversation.id;
  });

  afterAll(async () => {
    await prisma.paymentLink.deleteMany({ where: { tenantId } }).catch(() => {});
    await prisma.conversationSaleEvent.deleteMany({ where: { tenantId } }).catch(() => {});
    await prisma.conversation.deleteMany({ where: { tenantId } }).catch(() => {});
    await prisma.contact.deleteMany({ where: { tenantId } }).catch(() => {});
    await prisma.subscription.deleteMany({ where: { tenantId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { tenantId } }).catch(() => {});
    await prisma.tenant.deleteMany({ where: { id: tenantId } }).catch(() => {});
    await app.close();
  });

  it('approves a new sale when the conversation already has objective payment confirmation', async () => {
    await prisma.paymentLink.create({
      data: {
        tenantId,
        providerLinkId: 'provider-paid-1',
        externalId: `sales-charge|${tenantId}|paid-link-${Date.now()}`,
        name: 'Pedido pago',
        label: 'Checkout pago',
        value: 345,
        url: 'https://pay.test/paid-link',
        billingType: 'PIX',
        status: 'PAID',
        source: 'MANUAL',
        resourceType: 'PAYMENT',
        contactId,
        conversationId,
      },
    });

    const response = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/conversations/${conversationId}/sale-attribution`)
      .set('Cookie', [authCookie])
      .send({})
      .expect(201);

    expect(response.body).toEqual(
      expect.objectContaining({
        approved: true,
        conversationId,
        aiValidationStatus: 'APPROVED',
      }),
    );
  });
});
